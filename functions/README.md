# Firebase Cloud Functions

## GHIN Proxy Function

This Cloud Function acts as a proxy for GHIN API requests, allowing the React app to send authenticated requests with cookies (which browsers block for security reasons).

## Setup

1. Install dependencies:

```bash
cd functions
npm install
```

2. Build the functions:

```bash
npm run build
```

## Deploy

Deploy the function to Firebase:

```bash
firebase deploy --only functions
```

Or from the root directory:

```bash
npm run firebase
```

## Testing Locally

Start the Firebase emulator:

```bash
cd functions
npm run serve
```

This will start the function at `http://localhost:5001/<project-id>/us-central1/ghinProxy`

## Function: ghinProxy

**Endpoint:** `https://us-central1-ridgefield-golf-club.cloudfunctions.net/ghinProxy`

**Method:** POST

**Body:**

```json
{
  "golferId": "4542268",
  "startDate": "2020-10-27",
  "endDate": "2021-10-27",
  "limit": 25,
  "offset": 0,
  "statuses": "Validated",
  "cookie": "<GHIN cookie value>"
}
```

**Response:** GHIN API scores data

This function takes the cookie value and properly sets it in the Cookie header when making requests to the GHIN API.
