# portless
Easy local domains with superpowers

- Create virtual local hosts (with https)
- Expose public hosts with [ngrok](https://ngrok.com)
- Automatic certificates with [Let's Encrypt](https://letsencrypt.org/) for public hosts
- Automatic URL rewriting in resources sent over the network
- Automatic Cookie rewriting
- Background deamon

## Installation

```bash
npm i -g @portless/cli

# OR

yarn global add @portless/cli
```

## Configuration

Create a `portless.config.js` file in your project root:

```js
const pkg = require('./package.json')

module.exports = {
  // Project name
  projectName: pkg.name,

  // Define your domains here
  domains: [
    {
      id: 'app',
      public: 'app.ngrok.acme.com',
      local: 'app.acme.local',
      target: 'localhost:4000',
    },
    {
      id: 'graphql',
      public: 'graphql.ngrok.acme.com',
      local: 'graphql.acme.local',
      target: 'localhost:4100',
    },
  ],

  // Corporate proxy (optional)
  targetProxy: 'http://acme.com/proxy',

  // Enable Let's Encrypt automatic certificates (optional)
  greenlock: {
    configDir: './config/greenlock',
    packageAgent: `${pkg.name}/${pkg.version}`,
    maintainerEmail: 'tom@acme.com',
    // Use Let's Encrypt staging servers
    staging: true,
  },

  // Enable ngrok (optional)
  ngrok: {
    authtoken: '...',
    region: 'eu',
  },
}
```

Start the deamon (it will auto-start on login):

```bash
portless start
```

Register your project (current folder):

```bash
portless add
```

Refresh your project if you changed the configuration:

```bash
portless refresh
```

Stop and uninstall the deamon:

```bash
portless stop
```

## URL rewriting

You application should be setup to use your typical `localhost` URLs. Portless will take care of modifying them automatically on any resource sent via the network.

For example, if you expose your webpack dev server on `http://localhost:8080`, with the following domain in the config file:

```js
{
  id: 'webpack',
  public: 'webpack.local.acme.com',
  local: 'webpack.acme.local',
  target: 'localhost:8080'
}
```

Portless will automatically rewrite the URLs to either `webpack.local.acme.com` or `webpack.acme.local` depending on the request host.

### Special syntax

You can also use `http://graphql.portless` (with you domain `id` and the `.portless` extension) in your source code:

```js
fetch('http://graphql.portless')
```

With the following domain configuration:

```js
{
  id: 'graphql',
  public: 'graphql.local.acme.com',
  local: 'graphql.acme.local',
  target: 'localhost:4000'
}
```

Portless will automatically rewrite it too! If the request is coming from `webpack.local.acme.com`, it will transform your code to:

```js
fetch('http://graphql.local.acme.com')
```

And if the request comes from `webpack.acme.local`, it will rewrite it to:

```js
fetch('http://graphql.acme.local')
```

### HTTPS rewriting

Portless will also make sure all your referenced URLs are either all in `http` or all in `https` depending on the request host.

For example, if the request is made from `https://webpack.acme.local`, it will rewrite your code with an `https`:

```js
fetch('https://graphql.acme.local')
```
