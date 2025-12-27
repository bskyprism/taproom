# taproom

Look at information about a
[tap server](https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md).

This is a Cloudflare application.

There are [several env variables](#config) you can use to configure things.

<details><summary><h2>Contents</h2></summary>

<!-- toc -->

- [Use the Template](#use-the-template)
  * [Dependencies](#dependencies)
  * [Create a D1 Database](#create-a-d1-database)
  * [Create a KV Namespace](#create-a-kv-namespace)
- [Webauthn (passkey) Authentication](#webauthn-passkey-authentication)
- [Tap](#tap)
- [Config](#config)
  * [TAP_ADMIN_PASSWORD](#tap_admin_password)
  * [ALLOW_ANON_READS](#allow_anon_reads)
  * [REGISTRATION_SECRET](#registration_secret)
  * [Generate a Secret](#generate-a-secret)
  * [Frontend Env](#frontend-env)
- [Auth](#auth)
  * [Auth Flow](#auth-flow)
  * [Initial Setup](#initial-setup)
  * [Auth Flow](#auth-flow-1)
- [Develop](#develop)
  * [Commands](#commands)
- [Deploy](#deploy)
- [Notes](#notes)
  * [Add database](#add-database)
  * [A Test DID](#a-test-did)
  * [Some Links](#some-links)

<!-- tocstop -->

</details>


-------


## Use the Template

This is a template repository. Use the template button in the Github UI,
then clone and run a few commands on your local machine.

### Dependencies

```sh
npm i
```

### Create a D1 Database

```sh
npx wrangler d1 create taproom-auth
```

#### Add the ID to `wrangler.jsonc`

Copy the `database_id` value from above, and paste it 

```js
{
    // ...
	"d1_databases": [
		{
			"binding": "my_db",
			"database_name": "my-db",
			"database_id": "abc123"
		}
	],
    // ...
}
```

### Create a KV Namespace

This uses the `AUTH_CHALLENGES` KV namespace to store temporary authentication
challenges during the login flow. See [src/server/auth.ts](./src/server/auth.ts).

```sh
npx wrangler kv namespace create "AUTH_CHALLENGES"
```

Then add the returned ID to `wrangler.jsonc`:

```js
{
	"kv_namespaces": [
		{
			"binding": "AUTH_CHALLENGES",
			"id": "abc123"
		}
	],
}
```

----------

## Webauthn (passkey) Authentication

1. The server generates a random challenge and stores it temporarily in KV
2. The client signs the challenge with their passkey
3. The server retrieves the stored challenge to verify the signature
4. The challenge is deleted to prevent replay attacks



----------



## Tap

You should be running a Tap server also,
[which you can do with Docker](https://github.com/bluesky-social/indigo/tree/main/cmd/tap#distribution--deployment)
and a hosting service like fly.io.


----------


## Config

Add some env variables to `.dev.vars` locally. These should be set on
Cloudflare (or your platform) as well.

```sh
NODE_ENV="development"
TAP_SERVER_URL="https://my-server.fly.dev"
TAP_ADMIN_PASSWORD="abc123"
ALLOW_ANON_READS="true"
REGISTRATION_SECRET="abc123"
```

### TAP_ADMIN_PASSWORD

This is the secret for your tap server.

### ALLOW_ANON_READS

The Tap server requires the admin password for all requests. If this variable
is set, then read operations do not require any auth.

### REGISTRATION_SECRET

This is the secret key that you need in order to create a passkey. Once you
have created a passkey, subsequent auth can use the passkey.

### Generate a Secret

```sh
openssl rand -base64 32
```

### Frontend Env

The frontend code uses a variable `VITE_ALLOW_ANON_READS` in the `.env` file.
This determines which routes are shown to logged out users.



----------



## Auth

This is designed to use passkeys (`webauthn`) for authentication. Initial
registration (adding a new passkey) requires a secret key,
`REGISTRATION_SECRET`. You need to enter the correct key, then it will let you
create a new passkey.


### Auth Flow

1. **Initial Registration** - Protected by a secret key,`REGISTRATION_SECRET`.
   Enter the secret to register your device's passkey
   (fingerprint, Face ID, etc.)
2. **Authentication** - After registration, click "Login with Passkey" and
   complete the biometric prompt
3. **Sessions** - Valid for 30 days, stored as an httpOnly cookie
4. **Write Protection** - Routes like adding/removing repos require either a
   valid session or a Bearer token


### Initial Setup

Need to create some infrastructure. I'm using Cloudflare.


#### 1. Create the KV Namespace

```sh
npx wrangler kv namespace create "AUTH_CHALLENGES"
```

Add the returned ID to `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
    {
        "binding": "AUTH_CHALLENGES",
        "id": "your-id-here"
    }
],
```

#### 2. Run the Database Migration

```sh
# Local development
npx wrangler d1 execute taproom-auth --local --file=migrations/0001_passkeys.sql

# Production
npx wrangler d1 execute taproom-auth --remote --file=migrations/0001_passkeys.sql
```

#### 3. Create a Secret Value

A convenient way to generate a random key:

```sh
openssl rand -base64 32
```

For local development, add to `.dev.vars`:

```
REGISTRATION_SECRET="your-secret-here"
```

For production:

```sh
npx wrangler secret put REGISTRATION_SECRET
```

### Auth Flow

1. Visit the app - you'll see "Register Passkey" in the header
2. Enter your registration secret and click "Register Passkey"
3. Complete the biometric/passkey prompt on your device
4. You're now authenticated with a 30-day session
5. Future visits: click "Login with Passkey" to re-authenticate




-------



## Develop

Start a local Cloudflare instance via Vite.

```sh
npm start
```



### Commands

```sh
npm start      # Development server (Vite + Hono)
npm run build  # Build for production
npm run deploy # Build and deploy to Cloudflare
```


-------



## Deploy

```sh
# Run migrations on production (if not already done)
npx wrangler d1 execute taproom-auth --remote --file=migrations/0001_passkeys.sql

# Set production secrets (if not already done)
npx wrangler secret put REGISTRATION_SECRET
npx wrangler secret put TAP_ADMIN_PASSWORD
npx wrangler secret put API_AUTH_TOKEN

# Deploy the worker
npm run deploy
```



-------



## Notes

### Add database

Create a CF D1 database:

```sh
npx wrangler d1 create taproom-auth
```


Force local or remote DBs in dev mode.

```sh
wrangler dev --local          # force local SQLite
wrangler dev --remote         # force remote D1
```


### A Test DID

```
did:plc:ftzenmeeq3mzock6ee3hshr3
```

### Some Links

* The [tap typescript package](https://github.com/bluesky-social/atproto/tree/main/packages/tap)
