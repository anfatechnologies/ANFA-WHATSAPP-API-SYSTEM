import io
import httpx
from aiobotocore.session import get_session
from app.core.config import settings
import uuid

class ObjectStorageService:
    def __init__(self):
        self.session = get_session()

    async def _get_client(self):
        return self.session.create_client(
            's3',
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
        )

    async def upload_from_url(self, file_url: str, mime_type: str) -> str:
        """Download file from Meta and upload to MinIO."""
        # Meta media URL requires the Bearer token
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(file_url, headers=headers)
            response.raise_for_status()
            file_data = response.content

        file_extension = mime_type.split('/')[-1] if '/' in mime_type else 'bin'
        if ';' in file_extension:
            file_extension = file_extension.split(';')[0]
            
        file_name = f"{uuid.uuid4()}.{file_extension}"
        
        async with await self._get_client() as s3:
            await s3.put_object(
                Bucket=settings.MINIO_BUCKET,
                Key=file_name,
                Body=file_data,
                ContentType=mime_type
            )
            
        return f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{file_name}"
