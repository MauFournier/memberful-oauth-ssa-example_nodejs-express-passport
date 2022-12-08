/****************************************************************
 ** Memberful OAuth2 SSA API Example - Node.js + Express
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
const memberfulURL = 'https://jennysbakery.memberful.com';

// Your custom app's "OAuth Identifier", found in the Memberful dashboard.
const clientId = '58QsJa35WTDo9d8b9uuu7S57';

// Your custom app's "OAuth Secret", found in the Memberful dashboard.
const clientSecret = 'EmDCTnZCZf5SCyafbe5vLpxS';

// We'll use this variable for the sake of this example later on,
// we're just declaring it here so that we can have access to it globally.
// In a real app, you'd probably want to store this in a database. We'll
// talk about that below.
let stored_refresh_token = null;

//****************************************************************
//*** Express app
//****************************************************************

const app = express();

// Lobby: This route isn't part of the OAuth flow, it's just for convenience
app.get('/', (req, res) => {
  res.send(`
  <html><head></head><body>
    <h1>Memberful OAuth SSA Example - NodeJS + Express (with Passport auth library)</h1>
    <p><a href="${beginOAuthFlowWithPassportURL}">Begin OAuth Flow using Passport</a></p>
  </body></html>
  `);
});

// > Step 1) Configure Passport.
// We're using a typical Passport setup with sessions here.

app.use(
  session({
    secret:
      'YOU SHOULD COME UP WITH A SECURE SECRET, LIKE A RANDOM SET OF CHARACTERS',
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
    clientSecret: clientSecret,
    callbackURL: callbackURL,
  },

  // > Step 3) Define what happens after a successful OAuth flow
  // When this function gets called, it means we've
  // received an access token and a refresh token.
  async function (access_token, refresh_token, profile, callback) {
    console.log(`PASSPORT DONE! ACCESS TOKEN: ${access_token}
      REFRESH TOKEN: ${refresh_token}
      `);

    // Make sure you store the refresh_token somewhere
    // so you can use it later to refresh the access token
    // when it expires. For the sake of this example, we're
    // just storing it in a global variable. In a real app,
    // you'd probably want to store it in a database.
    stored_refresh_token = refresh_token;

    // > Step 5) Query Member Data
    // Now that we have an access token, we can use it to query the member's data

    // First, let's build our GraphQL query, which will tell Memberful which fields we want
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

      console.log('Back from API');
      console.log(memberDataResponse.data);

      // We now have the member's data!
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
      // Alternatively, you can run more queries on via our API:
      // https://memberful.com/help/custom-development-and-api/memberful-api/

      //We'll return some of the member's data via the callback function
      //so the route that initiated this whole sign-in flow can access it.
      return callback(null, memberDataResponse.data);
    } catch (error) {
      console.log(error);
      res.send(error.data);
    }
  }
);

// We've already defined how to handle a successful OAuth flow and
// how to query the member's data, but we still have some setup
// work to do in order for all this to work.

// > Step 4) Tell Passport to use our OAuth2Strategy
passport.use(strategy);
refresh.use(strategy);

// > Step 5) Define serialization and deserialization functions
// Passport stores the user's information as a session cookie.
// We need to tell it how to serialize and deserialize the user's
// information so that it can be stored and retrieved from the session.
// If you're not familiar with this concept, feel free to use the
// following functions as-is. If you want to learn more about this,
// check out the Passport documentation:
// https://www.passportjs.org/concepts/authentication/sessions/

// The serializeUser function is called when Passport
// receives a successful response from Memberful's OAuth2 server.
// We'll use it to store the user's profile information in the session.

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

// > Step 6) Define a route that will begin OAuth Flow
// This is the route we'll redirect to whenever a user tries
// to access a URL that requires authentication.
// It'll begin the OAuth flow using Passport.
app.get(beginOAuthFlowWithPassportURL, passport.authenticate('oauth2'));

// > Step 7) When a user attempts to access a protected URL,
// we'll check to see if they're authenticated. (we'll
// define such a route later in this script). If they're not
// authenticated, we'll redirect them to the route we defined
// in Step 5 above., which will begin the whole login process.

// > Step 8) User signs in via Memberful. We use passwordless sign-in by default,
// so they'll receive an email with a link to sign in. Once they click that link,
// they'll be redirected to the callback URL you set in the Memberful dashboard.

// Note: The link they receive in their email will include a token. This token
// is not the same as the auth code we're looking for. It's not part of this flow.

// > Step 9) Define a protected route:
// A route that requires authentication.

// This is what truly begins the whole authentication flow:
// If the user is not authenticated, they will be redirected to the
// login route, which will start the OAuth flow.
// If the user is authenticated, they will be allowed to access this route,
// and the user's profile information (which we'll later pull from the
// Memberful API) will be available in req.user.
app.get(
  callbackURL,
  passport.authenticate('oauth2', {
    failureRedirect: beginOAuthFlowWithPassportURL,
  }),
  function (req, res) {
    //We made it to the protected route! The user is authenticated.

    res.send(`
      <html><head></head><body>
        <h2>Member's data:</h2>
        <pre>${JSON.stringify(req.user, null, 2)}</pre>
      </body></html>
      `);

    // > Step 10) Refresh token request
    // Access tokens are valid for 15 minutes.
    // You can use the refresh token (provided along with each access token)
    // to get a new access token. Refresh tokens are valid for one year.
    // To obtain a new access token, send a POST request to:
    // https://YOURSITE.memberful.com/oauth/token

    // You can end the process here, but we also wanted to show
    // how to refresh the access token. You probably wouldn't
    // want to do this at this point in the flow, so just imagine that
    // we're doing this a few hours later, when the original
    // access token has expired.

    // We'll define the following function below.
    refreshTheToken();
  }
);

const refreshTheToken = () => {
  refresh.requestNewAccessToken(
    strategy.name,
    stored_refresh_token,
    function (err, accessToken, refreshToken) {
      if (err !== null) {
        console.log('Error refreshing token: ', err);
      } else {
        console.log("We've refreshed the token!");
        // We now have a new access token!
        // Example response:
        // refreshTokenResponse.data === {
        //     "access_token": "wMGRkW7ahw1vFNctr1uCzLQd",
        //     "expires_in": 899,
        //     "refresh_token": "AgKtiGrPiBAKtsPGx4kKduuk",
        //     "token_type": "bearer"
        // }
        console.log('accessToken: ', accessToken);
        console.log('refreshToken: ', refreshToken);
      }
    }
  );
};

// Start the Express server
const PORT = process.env.PORT || defaultPort;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

// That's it! For more information on this process, check out our docs:
// https://memberful.com/help/custom-development-and-api/sign-in-for-apps-via-oauth/
