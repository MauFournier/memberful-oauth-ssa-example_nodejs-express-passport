/****************************************************************
 ** Memberful OAuth2 SSA Example - Node.js + Express + Passport
 **
 ** This example shows how to use the Memberful OAuth2 Server-side
 ** app flow to authenticate a user and retrieve their profile information.
 **
 ** This is the flow you would use for a server-side application.
 ** If you're building a client-side NodeJS application, you should
 ** use the Client-side PKCE flow instead.
 **
 ** For more information, check out our documentation:
 ** https://memberful.com/help/custom-development-and-api/sign-in-for-apps-via-oauth/
 ****************************************************************/

import express from 'express';
import session from 'express-session';
import axios from 'axios';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';
import refresh from 'passport-oauth2-refresh';

//****************************************************************
//*** Configuration
//****************************************************************

const defaultPort = 3000;

// Choose the URL you want to use for the sign-in route
const beginOAuthFlowWithPassportURL = '/login';

// Choose the URL you want to use for the callback route.
// This must match the callback URL you set as the Redirect URL
// for your Custom OAuth app in the Memberful dashboard
const callbackURL = '/callback';

// Your Memberful account subdomain (e.g. https://example.memberful.com).
const memberfulURL = 'INSERT_YOUR_MEMBERFUL_URL_HERE';

// Your custom app's "OAuth Identifier", found in the Memberful dashboard.
const clientId = 'INSERT_YOUR_OAUTH_IDENTIFIER_HERE';

// Your custom app's "OAuth Secret", found in the Memberful dashboard.
const clientSecret = 'INSERT_YOUR_OAUTH_SECRET_HERE';

// We'll use this variable for the sake of this example later on,
// we're just declaring it here so that we can have access to it globally.
// In a real app, you'd probably want to store this in a database. We'll
// talk about that below.
let stored_refresh_token = null;

//****************************************************************
//*** Begin Express app
//****************************************************************

const app = express();

// Lobby: This route isn't part of the OAuth flow, it's just for
// our convenience during development.
app.get('/', (req, res) => {
  res.send(`
  <html><head></head><body>
    <h1>Memberful OAuth SSA Example - NodeJS + Express (with Passport auth library)</h1>
    <p><a href="${beginOAuthFlowWithPassportURL}">Begin OAuth Flow using Passport</a></p>
  </body></html>
  `);
});

//****************************************************************
//*** Configure Passport
//****************************************************************

// Because we're using Passport, there are a few configuration
// steps we need to do before we can begin the OAuth flow.

// > Step 1) Configure Passport.
// We'll be using a typical Passport setup with sessions.

app.use(
  session({
    secret:
      'REPLACE THIS WITH A SECURE SECRET, LIKE A RANDOM SET OF CHARACTERS',
  })
);

app.use(passport.initialize());
app.use(passport.session());

// > Step 2) Configure the OAuth2Strategy
// This is where we'll show Passport which URLs and credentials
// to use when communicating with Memberful's OAuth2 server.
// We'll also define what to do when Passport has successfully
// authenticated a user.

// We're using the Passport OAuth2Strategy module
// https://www.npmjs.com/package/passport-oauth2
const strategy = new OAuth2Strategy(
  {
    authorizationURL: `${memberfulURL}/oauth`,
    tokenURL: `${memberfulURL}/oauth/token`,
    clientID: clientId,
    callbackURL: callbackURL,
    clientSecret: clientSecret,
  },

  // This function will be called when Passport has successfully
  // authenticated a user. We'll look at this function in more detail
  // later on. You could define an inline function here instead.
  handleSuccessfulOAuthFlow
);

// > Step 3) Tell Passport to use our OAuth2Strategy
passport.use(strategy);
refresh.use(strategy);

// > Step 4) Define serialization and deserialization functions.

// Passport stores the user's information as a session cookie.
// We need to tell it how to serialize and deserialize the user's
// information so that it can be stored and retrieved from the session.

// If you're not familiar with this concept, feel free to use the
// following functions as-is. If you want to learn more about this,
// check out the Passport documentation:
// https://www.passportjs.org/concepts/authentication/sessions/

// The serializeUser function is called when Passport
// receives a successful response from Memberful's OAuth2 server.

passport.serializeUser(function (user, callback) {
  console.log(
    `Storing a subset of the user data into the session cookie...
    Here's the full user we received:`,
    user
  );
  const myUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  };

  callback(null, user);
});

passport.deserializeUser(function (user, callback) {
  callback(null, user);
});

// Feel free to expand the serializeUser and deserializeUser
// functions above with your own custom user management code.
// Check out the following URL for more information:
// https://www.passportjs.org/concepts/authentication/sessions/

//****************************************************************
//*** Define a login route and a protected route
//****************************************************************

// > Step 6) Define a route that will begin OAuth Flow
// This is the route we'll redirect to when a user tries
// to access a different route that requires authentication.
// This route will begin the OAuth flow using Passport.
app.get(beginOAuthFlowWithPassportURL, passport.authenticate('oauth2'));

// > Step 7) Define a protected route:
// A route that requires authentication.

// This is what truly begins the whole authentication flow:
// If the user is not authenticated, they will be redirected to the
// login route we declared in step 6 (and which we'll define soon).
// This will begin the OAuth flow.

// If the user is authenticated, they will be allowed to access this route,
// and the user's profile information (which we'll soon pull from the
// Memberful API) will become available in req.user.
app.get(
  callbackURL,
  passport.authenticate('oauth2', {
    failureRedirect: beginOAuthFlowWithPassportURL,
  }),
  function (req, res) {
    // If this function is executed, it means we made it
    // to the protected route! The user is authenticated.

    res.send(`
      <html><head></head><body>
        <h2>Member's data:</h2>
        <pre>${JSON.stringify(req.user, null, 2)}</pre>
      </body></html>
      `);
  }
);

//****************************************************************
//*** Handle a successful flow
//****************************************************************

// That was a lot of setup, but now we can go over the OAuth flow
// and define what happens after a successful sign-in.

// > Step 8) When a user attempts to access a protected URL,
// we'll check to see if they're authenticated. If they're not
// authenticated, we'll redirect them to the route we defined
// in Step 6 above, which will begin the whole login process.

// > Step 9) The member signs in via Memberful. We use passwordless sign-in by default,
// so they'll receive an email with a link to sign in. Once they click that link,
// they'll be redirected to the callback URL you set in the Memberful dashboard,
// which will be the route we defined in Step 7 above.

// Note: The link they receive in their email will include a token. This token
// is NOT the auth code we're looking for. It's not part of this flow.

// > Step 10) Define what happens after a successful OAuth flow.
// When this function gets called, it means we've
// received an access token and a refresh token.
async function handleSuccessfulOAuthFlow(
  access_token,
  refresh_token,
  profile,
  callback
) {
  console.log(`Received access token: ${access_token}
      Received refresh token: ${refresh_token}
      `);

  // Make sure you store the refresh_token somewhere
  // so you can use it later to refresh the access token
  // after it expires. For the sake of this example, we're
  // just storing it in a global variable. In a real app,
  // you'd probably want to store it in a database.
  stored_refresh_token = refresh_token;

  // > Step 5) Query Member Data
  // Now that we have an access token, we can use it to query the member's data

  // First, let's build our GraphQL query, which will tell Memberful which fields we want.
  // To learn more about our API and which fields are available, check out these two articles:
  // https://memberful.com/help/custom-development-and-api/sign-in-for-apps-via-oauth/#requesting-member-data
  // https://memberful.com/help/custom-development-and-api/memberful-api/#using-the-graphql-api-explorer
  const memberQuery = `
      {
        currentMember {
          id
          email
          fullName
          subscriptions {
            active
            expiresAt
            plan {
              id
              name
            }
          }
        }
      }
      `;

  try {
    // Make a GET request to this URL:
    // https://YOURSITE.memberful.com/api/graphql/member?query=GRAPHQL_QUERY
    const memberDataResponse = await axios.get(
      `${memberfulURL}/api/graphql/member?query=${memberQuery}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    console.log('Received a response from the API', memberDataResponse.data);

    // We should receive the member's data in the response.
    //
    // Example response:
    // memberDataResponse.data === {
    //   "currentMember": {
    //       "id": "2406643",
    //       "email": "zamentik@gmail.com",
    //       "fullName": "Zam",
    //       "subscriptions": [
    //           {
    //               "plan": {
    //                   "id": "65673",
    //                   "name": "One time success"
    //               },
    //               "active": true,
    //               "expiresAt": null
    //           }
    //       ]
    //   }
    //}

    // Feel free to use this data inside your app.
    // Alternatively, you can run more queries to fetch more data via our API:
    // https://memberful.com/help/custom-development-and-api/memberful-api/

    // > Step 10) Refresh token request
    // Access tokens are valid for 15 minutes.
    // You can use the refresh token (provided with each access token)
    // to get a new access token. Refresh tokens are valid for one year.

    // You probably wouldn't want to refresh the token so soon,
    // but we want to include an example of how to do this,
    // so just imagine that we're doing this a few hours later,
    // once the original access token has expired.

    // To refresh the token, send a POST request to:
    // https://YOURSITE.memberful.com/oauth/token

    refresh.requestNewAccessToken(
      strategy.name, // The name of the strategy we defined in Step 2
      stored_refresh_token, // The refresh token we received in Step 10
      function (err, accessToken, refreshToken) {
        if (err !== null) {
          console.log('Error refreshing token: ', err);
        } else {
          // We now have a new access token! Example:

          // accessToken = "wMGRkW7ahw1vFNctr1uCzLQd"
          // refreshToken = "AgKtiGrPiBAKtsPGx4kKduuk",

          console.log(
            "We've refreshed the token! New access token: ",
            accessToken,
            'Refresh token stays the same: ',
            refreshToken
          );
        }
      }
    );

    //We can return some of the member's data via the callback function
    //so that the route that initiated this whole sign-in flow can access it.
    return callback(null, memberDataResponse.data);
  } catch (error) {
    console.log(error);
    res.send(error.data);
  }
}

// Start the Express server
const PORT = process.env.PORT || defaultPort;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

// That's all! For more information on this process, check out our docs:
// https://memberful.com/help/custom-development-and-api/sign-in-for-apps-via-oauth/
