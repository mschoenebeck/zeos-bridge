const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = 3005;
const PORT_SSL = 8445;

const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextEncoder, TextDecoder } = require('util');
const signatureProvider = new JsSignatureProvider(['5KKLfRYwWupnvfDrWqraxyjSbRK16vmidyJg2rS4ToHTddKSy1T']);
const rpc = new JsonRpc("https://test.ultra.eosusa.io", { fetch });
const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
});

const faucetAccounts = new Map();

// Middleware to set cross-origin isolation headers
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'ui/build')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// params: account
app.post('/faucet', async function (req, res) {
    if(!req.body.hasOwnProperty('account')) return res.status(400).send({ error: 'Missing params: account' });
    res.setHeader('content-type', 'application/json');

    if(faucetAccounts.has(req.body.account))
    {
        console.log('Transaction failed: Account received tokens already!');
        res.json({ status: "Transaction failed: Account received tokens already!" });
    }
    else
    {
        try {
            const result = await api.transact({
                actions: [{
                    account: '1aa2aa3aa4pr',
                    name: 'issue',
                    authorization: [{
                        actor: '1aa2aa3aa4pm',
                        permission: 'active',
                    }],
                    data: {
                        to: req.body.account,
                        quantity: '100.0000 CLOAK',
                        memo: 'CLOAK Faucet',
                    },
                }]
            }, {
                blocksBehind: 3,
                expireSeconds: 30,
            });

            console.log('Transaction successful: ', result.transaction_id);
            res.json({ status: "Transaction successful: " + result.transaction_id });
            faucetAccounts.set(req.body.account, true);
        } catch (error)
        {
            console.error('Transaction failed: ', error);
            res.json({ status: "Transaction failed: " + error });
        }
    }
});

// Handle requests for specific files or fallback to index.html
//app.get('*', (req, res) => {
//    const filePath = path.join(__dirname, 'ui/build', req.path);
//
//    // Check if the requested file exists
//    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
//        res.sendFile(filePath);
//    } else {
//        // Fallback to React's index.html for client-side routing
//        res.sendFile(path.join(__dirname, 'ui/build', 'index.html'));
//    }
//});

// Start the server
//app.listen(PORT, () => {
//  console.log(`Server running at http://localhost:${PORT}`);
//});

// start the server...
var privateKey  = fs.readFileSync('./selfsigned.key', 'utf8');
var certificate = fs.readFileSync('./selfsigned.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};
var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);
httpServer.listen(PORT);
httpsServer.listen(PORT_SSL);
console.log(`http server running at: http://localhost:${PORT}`);
console.log(`https server running at: https://localhost:${PORT_SSL}`);
