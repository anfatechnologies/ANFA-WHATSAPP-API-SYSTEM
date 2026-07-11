# /backend/app/services/tunelab_client.py
# ANFA TuneLab Integration - Server-side Checkpoint Override Support
# Provides enterprise ML inference pipeline integration with configurable
# server-side vs client-side checkpoint path resolution.

import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class WizPyServerConfig:
    """Standardized schema structure to parse and normalize configurations
    from legacy and modern TuneLab platforms.
    
    Attributes:
        checkpoint_path: Path to the model checkpoint file
        inference_engine: Backend inference engine (vllm, tensorrt, etc.)
        max_tokens: Maximum generation tokens
        temperature: Sampling temperature
        custom_overrides: Additional engine-specific parameters
    """
    checkpoint_path: str = "/models/default"
    inference_engine: str = "vllm"
    max_tokens: int = 2048
    temperature: float = 0.7
    custom_overrides: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InferenceResult:
    """Result from an ML inference request."""
    generated_text: str
    tokens_used: int
    finish_reason: str
    model_checkpoint: str
    latency_ms: float


# =============================================================================
# TUNELAB CLIENT
# =============================================================================

class TuneLabFungibilityClient:
    """Client for TuneLab enterprise ML inference pipeline.
    
    Supports server-side checkpoint path override gated behind the
    athena_ml_enable_server_side_checkpoint_path_override setting.
    
    When server-side override is enabled:
    - Reads checkpoint_path from server's wiz_server_config_options
    - Client-provided checkpoint paths are ignored
    
    When server-side override is disabled:
    - Reads checkpoint_path from client's wiz_config_options
    - Client can specify custom checkpoint paths
    """
    
    def __init__(self, enable_server_side_override: bool = False):
        self.enable_server_side_override = enable_server_side_override
        self.api_endpoint = settings.TUNELAB_API_ENDPOINT
        self.api_key = settings.TUNELAB_API_KEY
        
        logger.info(
            f"TuneLab client initialized "
            f"(server_side_override={'enabled' if enable_server_side_override else 'disabled'})"
        )
    
    async def _get_platform_fungibility_service_response(
        self,
        endpoint: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Send an asynchronous POST request to fetch current pipeline settings.
        
        Communicates with the TuneLab fungibility service to retrieve
        the active server configuration including checkpoint paths,
        inference engine settings, and capacity constraints.
        
        Args:
            endpoint: Full URL to the fungibility service endpoint
            payload: Request body containing client capabilities and preferences
            
        Returns:
            dict: Server response with configuration options
            
        Raises:
            RuntimeError: If the service returns a non-200 status code
            ConnectionError: If the request fails due to network issues
        """
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(endpoint, json=payload, headers=headers)
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 401:
                    raise RuntimeError(
                        f"TuneLab authentication failed: {response.text}"
                    )
                elif response.status_code == 429:
                    raise RuntimeError(
                        f"TuneLab rate limit exceeded: {response.text}"
                    )
                else:
                    raise RuntimeError(
                        f"TuneLab Service Error: HTTP {response.status_code} - {response.text}"
                    )
                    
            except httpx.RequestError as e:
                raise ConnectionError(f"Failed to connect to TuneLab service: {e}")
    
    def _get_wiz_py_server_config(
        self,
        response_data: Dict[str, Any],
    ) -> WizPyServerConfig:
        """Extract and normalize server-side configuration profiles.
        
        If server-side override is enabled, reads "wiz_server_config_options"
        from the payload (server-controlled checkpoint paths).
        
        If disabled, reads "wiz_config_options" (client-controlled paths).
        
        Args:
            response_data: Raw JSON response from the fungibility service
            
        Returns:
            WizPyServerConfig: Normalized configuration object
        """
        # Select configuration key based on override setting
        config_key = (
            "wiz_server_config_options"
            if self.enable_server_side_override
            else "wiz_config_options"
        )
        
        config_payload = response_data.get(config_key, {})
        
        if not config_payload:
            logger.warning(
                f"No configuration found under key '{config_key}', "
                f"using defaults"
            )
        
        return WizPyServerConfig(
            checkpoint_path=config_payload.get("checkpoint_path", "/models/default"),
            inference_engine=config_payload.get("inference_engine", "vllm"),
            max_tokens=int(config_payload.get("max_tokens", 2048)),
            temperature=float(config_payload.get("temperature", 0.7)),
            custom_overrides=config_payload.get("custom_overrides", {}),
        )
    
    def _maybe_update_config_with_user_checkpoint(
        self,
        config: WizPyServerConfig,
        user_checkpoint: Optional[str],
    ) -> WizPyServerConfig:
        """Conditionally update the checkpoint path if server-side override is disabled.
        
        When server-side override is enabled, the server controls checkpoint
        selection for compliance and governance. When disabled, user-specified
        checkpoints are honored for flexibility.
        
        Args:
            config: Current server configuration
            user_checkpoint: Checkpoint path requested by the user/client
            
        Returns:
            WizPyServerConfig: Potentially updated configuration
        """
        if user_checkpoint and not self.enable_server_side_override:
            config.checkpoint_path = user_checkpoint
            logger.debug(f"Applied user checkpoint: {user_checkpoint}")
        elif user_checkpoint and self.enable_server_side_override:
            logger.info(
                f"Ignoring user checkpoint '{user_checkpoint}' - "
                f"server-side override is enabled"
            )
        return config
    
    def _update_wiz_py_server_config(
        self,
        target_config: WizPyServerConfig,
        update_values: Dict[str, Any],
    ) -> WizPyServerConfig:
        """Update target parameters dynamically while enforcing dataclass types.
        
        Provides type-safe mutation of configuration values. Each update
        is validated against the expected type of the target field to
        prevent type corruption.
        
        Args:
            target_config: Configuration to modify (modified in place)
            update_values: Dictionary of field names to new values
            
        Returns:
            WizPyServerConfig: The modified configuration object
            
        Raises:
            AttributeError: If a field name doesn't exist in the config
            TypeError: If a value cannot be converted to the expected type
        """
        for key, value in update_values.items():
            if hasattr(target_config, key):
                # Get expected type from current value
                current_value = getattr(target_config, key)
                expected_type = type(current_value)
                
                try:
                    # Attempt type conversion
                    if expected_type is dict and isinstance(value, str):
                        # Handle JSON string to dict conversion
                        import json
                        converted_value = json.loads(value)
                    else:
                        converted_value = expected_type(value)
                    
                    setattr(target_config, key, converted_value)
                    logger.debug(f"Updated {key} = {converted_value}")
                    
                except (ValueError, TypeError) as e:
                    raise TypeError(
                        f"Cannot convert '{key}' value to {expected_type.__name__}: {e}"
                    )
            else:
                raise AttributeError(
                    f"WizPyServerConfig has no attribute '{key}'. "
                    f"Available: {[f for f in target_config.__dataclass_fields__]}"
                )
        
        return target_config
    
    async def run_inference(
        self,
        prompt: str,
        user_checkpoint: Optional[str] = None,
        override_params: Optional[Dict[str, Any]] = None,
    ) -> InferenceResult:
        """Execute ML inference through the TuneLab pipeline.
        
        Full workflow:
        1. Fetch current server configuration
        2. Resolve checkpoint path (server or client controlled)
        3. Apply any parameter overrides
        4. Send inference request
        5. Return structured result
        
        Args:
            prompt: Input text for generation
            user_checkpoint: Optional checkpoint path (ignored if server-side override)
            override_params: Optional parameter overrides
            
        Returns:
            InferenceResult: Structured inference output
        """
        import time
        
        # Step 1: Fetch platform configuration
        fungibility_payload = {
            "client_capabilities": ["whatsapp_crm", "async_generation"],
            "requested_model_family": "llama",
            "priority": "normal",
        }
        
        response_data = await self._get_platform_fungibility_service_response(
            endpoint=f"{self.api_endpoint}/fungibility",
            payload=fungibility_payload,
        )
        
        # Step 2: Extract server config
        config = self._get_wiz_py_server_config(response_data)
        
        # Step 3: Resolve checkpoint path
        config = self._maybe_update_config_with_user_checkpoint(config, user_checkpoint)
        
        # Step 4: Apply parameter overrides
        if override_params:
            config = self._update_wiz_py_server_config(config, override_params)
        
        # Step 5: Execute inference
        inference_payload = {
            "checkpoint_path": config.checkpoint_path,
            "inference_engine": config.inference_engine,
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
            "prompt": prompt,
            **config.custom_overrides,
        }
        
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        start_time = time.time()
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.api_endpoint}/generate",
                json=inference_payload,
                headers=headers,
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            if response.status_code != 200:
                raise RuntimeError(
                    f"Inference failed: HTTP {response.status_code} - {response.text}"
                )
            
            result = response.json()
            
            return InferenceResult(
                generated_text=result.get("generated_text", ""),
                tokens_used=result.get("tokens_used", 0),
                finish_reason=result.get("finish_reason", "unknown"),
                model_checkpoint=config.checkpoint_path,
                latency_ms=latency_ms,
            )


# =============================================================================
# FACTORY FUNCTION
# =============================================================================

def get_tunelab_client() -> TuneLabFungibilityClient:
    """Factory function to create a TuneLab client with application settings.
    
    Reads the server-side override flag from environment configuration.
    """
    return TuneLabFungibilityClient(
        enable_server_side_override=settings.ATHENA_ML_ENABLE_SERVER_SIDE_CHECKPOINT_PATH_OVERRIDE,
    )
