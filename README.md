# taproom

View information about a
[tap server](https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md).

This is a Cloudflare application 

<details><summary><h2>Contents</h2></summary>
<!-- toc -->
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
# Run migrations on production
npx wrangler d1 execute your-database-name --remote --file ./schema.sql

# Deploy the worker
npx wrangler deploy
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
