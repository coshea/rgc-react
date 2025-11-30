# EmailJS Configuration Setup

## Local Development

1. Create a `.env.local` file in the project root:

   ```bash
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key
   ```

2. Get your credentials from https://dashboard.emailjs.com/admin

3. Restart your dev server: `npm run dev`

## Production (Firebase App Hosting)

### Prerequisites

- Google Cloud SDK installed
- Project must be authenticated: `gcloud auth login`
- Set your project: `gcloud config set project ridgefield-golf-club`

### Create Secrets in Cloud Secret Manager

Run these commands to create the secrets:

```bash
# Create EmailJS Service ID secret
echo -n "your_service_id" | gcloud secrets create emailjs-service-id --data-file=-

# Create EmailJS Template ID secret
echo -n "your_template_id" | gcloud secrets create emailjs-template-id --data-file=-

# Create EmailJS Public Key secret
echo -n "your_public_key" | gcloud secrets create emailjs-public-key --data-file=-
```

### Grant Access to App Hosting

Grant the App Hosting service account access to the secrets:

```bash
# Get your App Hosting service account
# Format: <PROJECT_NUMBER>-compute@developer.gserviceaccount.com
# Find your project number in Firebase console or run:
gcloud projects describe ridgefield-golf-club --format="value(projectNumber)"

# Grant access to each secret (replace PROJECT_NUMBER with your actual number)
gcloud secrets add-iam-policy-binding emailjs-service-id \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding emailjs-template-id \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding emailjs-public-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Deploy

After setting up secrets, deploy your app:

```bash
npm run firebase
```

The secrets will be automatically injected as environment variables during build time.

## Updating Secrets

To update a secret value:

```bash
echo -n "new_value" | gcloud secrets versions add emailjs-service-id --data-file=-
```

Then redeploy your app.

## Verifying Setup

After deployment, test the contact form. Check the browser console for any configuration errors.

## EmailJS Template Setup

Your EmailJS template should include these variables:

```
From: {{from_name}} <{{from_email}}>

Message:
{{message}}

---
This email was sent from the RGC Contact Form
```

## Troubleshooting

**"Email service is not configured" error:**

- Verify secrets exist: `gcloud secrets list`
- Check secret values: `gcloud secrets versions access latest --secret=emailjs-service-id`
- Verify IAM permissions are granted
- Redeploy after making changes

**Emails not sending:**

- Check EmailJS dashboard for quota/limits
- Verify domain is allowed in EmailJS settings
- Check browser console for CORS errors
