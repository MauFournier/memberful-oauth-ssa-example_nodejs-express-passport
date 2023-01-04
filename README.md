A simple example of Memberful's Server-Side App (SSA) OAuth flow written in NodeJS and Express, using the Passport Authentication library.

Note: If you're building a mobile or Single-Page application, you should use the PKCE flow instead.

## Installation

Run the following command to install dependencies:

```bash
npm install
```

## Usage

To test locally, run the following command to start the server:

```bash
npm start
```

You can also upload this to a publicly accessible server and run it there.

Open the following URL to verify that the server is running properly — You should see a "lobby" page with a link to begin the OAuth flow.

```bash
http://localhost:3000/
```

(if you're not running this locally, replace localhost:3000 with your server's public URL)

Now that we know the server is running properly, let's create a Custom Application in Memberful.

Go to Settings → Custom applications and create a new application. Check the "include OAuth tokens with this application" checkbox.

This example is showing the SSA flow, so pick either "Server-side Application" as the application type.

For your OAuth Redirect URL, enter the following:

```bash
http://localhost:3000/callback
```

(if you're not running this locally, replace localhost:3000 with your server's public URL)

Copy your custom app's "OAuth Identifier" and paste it into src/index.js as the value of the **clientId** variable (you'll see a comment about this in the code).

Copy your custom app's "OAuth Secret" and paste it into src/index.js as the value of the **clientSecret** variable (you'll see a comment about this in the code).

Now we're ready to begin the OAuth flow by opening the following URL.

```bash
http://localhost:3000/begin-oauth-flow
```

You can change the path for this route and for the callback near the top of the src/index.js file. (If you change the callback path, you'll need to create a new Custom Application in Memberful and replace the OAuth Identifier with the new one.)

If everything works, you'll be asked to sign in (you'll need a member account to sign into), and then you'll end up at the /callback route with the member's data being displayed. It'll look something like this:

```javascript
Member's data:
{
  "data": {
    "currentMember": {
      "id": "2406643",
      "email": "maren.member@gmail.com",
      "fullName": "Maren",
      "subscriptions": [
        {
          "active": false,
          "expiresAt": 1667066915,
          "plan": {
            "id": "78645",
            "name": "Premium Monthly"
          }
        },
        {
          "active": true,
          "expiresAt": null,
          "plan": {
            "id": "65673",
            "name": "One time success"
          }
        },
        {
          "active": false,
          "expiresAt": 1655999542,
          "plan": {
            "id": "62764",
            "name": "Premium"
          }
        }
      ]
    }
  }
}
```

You can also find logs of the access token, refresh token, member's data, and refreshed access token in the console.

Visit [this article](https://memberful.com/help/custom-development-and-api/sign-in-for-apps-via-oauth/#requesting-member-data) to learn about how you can use this access token to fetch the member's data from Memberful's API.
