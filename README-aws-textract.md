# AWS Textract local setup

1. Create or sign in to your AWS account.
2. Create an IAM user for this app.
3. Attach the following policy to the user:
   - AmazonTextractFullAccess
4. Create access keys and copy the Access Key ID and Secret Access Key.
5. Put them in backend/.env:

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN=OPTIONAL_IF_USING_TEMP_CREDENTIALS
USE_LOCAL_MOCK_TEXTRACT=false

6. Restart the backend.

If you want to test without AWS first, keep USE_LOCAL_MOCK_TEXTRACT=true.
