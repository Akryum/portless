# portless
Easy local domains with superpowers

```bash
npm i -g @portless/cli

# OR

yarn global add @portless/cli
```

Create a `portless.config.js` file in your project root:

```js
const pkg = require('./package.json')

module.exports = {
  // Project name (required)
  projectName: pkg.name,

  // Reverse HTTP proxy
  reverseProxy: {
    redirects: [
      {
        // Listening port
        port: 4440,
        // Target URL
        target: 'https://app.acme.local',
      },
      {
        port: 4441,
        target: 'https://graphql.acme.local',
      },
    ],
  },

  // Public/Local domains mapping
  domains: [
    {
      publicUrl: 'https://app.ngrok.acme.com',
      targetUrl: 'https://app.acme.local',
    },
    {
      publicUrl: 'https://graphql.ngrok.acme.com',
      targetUrl: 'https://graphql.acme.local',
    },
  ],

  // Corporate/Hotel proxy
  targetProxy: 'http://localhost:2000/proxy.pac',

  // Enable Let's Encrypt automatic certificates
  greenlock: {
    packageAgent: `${pkg.name}/${pkg.version}`,
    maintainerEmail: 'tom@acme.com',
    // Use Let's Encrypt staging servers
    staging: true,
  },

  // Enable ngrok
  ngrok: {
    authtoken: '...',
    region: 'eu',
  },
}
```

Then run the `serve` command in your project root:

```bash
portless serve
```
