import asyncio
import json
from aiobotocore.session import get_session
from app.core.config import settings

async def setup_minio_lifecycle():
    session = get_session()
    async with session.create_client(
        's3',
        endpoint_url=settings.MINIO_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
    ) as s3_client:
        
        # Check if bucket exists, create if not
        try:
            await s3_client.head_bucket(Bucket=settings.MINIO_BUCKET)
            print(f"Bucket {settings.MINIO_BUCKET} exists.")
        except Exception:
            print(f"Creating bucket {settings.MINIO_BUCKET}...")
            await s3_client.create_bucket(Bucket=settings.MINIO_BUCKET)
            
        lifecycle_configuration = {
            'Rules': [
                {
                    'ID': 'DeleteOldMedia',
                    'Filter': {'Prefix': ''},
                    'Status': 'Enabled',
                    'Expiration': {
                        'Days': 30
                    }
                }
            ]
        }
        
        print("Applying lifecycle policy to delete files older than 30 days...")
        await s3_client.put_bucket_lifecycle_configuration(
            Bucket=settings.MINIO_BUCKET,
            LifecycleConfiguration=lifecycle_configuration
        )
        print("Lifecycle policy applied successfully.")

if __name__ == "__main__":
    asyncio.run(setup_minio_lifecycle())
