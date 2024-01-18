import logo from './logo.png';
import './App.css';
import React, { useState, useEffect } from 'react';
import { SessionKit } from "@wharfkit/session"
import { TransactPluginCosigner } from "@wharfkit/transact-plugin-cosigner"
import { WebRenderer } from "@wharfkit/web-renderer"
import { WalletPluginAnchor } from "@wharfkit/wallet-plugin-anchor"
import params_min_b64 from './params_mint.b64';
import init, { js_zsign_transfer_and_mint_transaction } from './pkg_st/zeos_caterpillar.js'

await init();

const fromB64String = (b64String) => Uint8Array.from(atob(b64String), c => c.charCodeAt(0))
let mint_params_bytes;
fetch(params_min_b64).then(r => r.text()).then(text => {
    mint_params_bytes = fromB64String(text)
    //console.log(mint_params_bytes)
});

const webRenderer = new WebRenderer()
const sessionKit = new SessionKit({
    appName: "appname",
    chains: [
        {
        id: "df0d1aacf71a6d61b11eee7b0e52cc54302b18f76346c7287f8c252a3de172f2",
        url: "http://localhost:8888",
        },
    ],
    ui: webRenderer,
    walletPlugins: [new WalletPluginAnchor()]
})

const apiNodes = [
    "http://localhost:8888"
];
var apiNodeIndex = 0;
async function fetch_fee_table()
{
    try
    {
        // fetch info from chain
        const response = await fetch(apiNodes[apiNodeIndex] + '/v1/chain/get_table_rows', {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({ code: 'thezeosalias', table: 'fees', scope: 'thezeosalias', lower_bound: 0, json: true })
        });
        const res = await response.json();
        return {
            token_contract: res.rows[0].token_contract,
            fees: {
                authenticate: res.rows[0].fees[0].second,
                begin: res.rows[0].fees[1].second,
                mint: res.rows[0].fees[2].second,
                output: res.rows[0].fees[3].second,
                publishnotes: res.rows[0].fees[4].second,
                spend: res.rows[0].fees[5].second,
                spendoutput: res.rows[0].fees[6].second,
                withdraw: res.rows[0].fees[7].second
            }
        };
    }
    catch(err)
    {
        console.log(err.message);
    }
    apiNodeIndex = (apiNodeIndex === apiNodes.length-1) ? 0 : apiNodeIndex+1;
}

function App()
{
    const [session, setSession] = useState(undefined);
    let desc_json = session ? `[
    {
        "to": "za1myffclyc7d5k05q9tpd9kn74el0uljwhfycm0kxnqmpvv5qzcm8wezc70855rlsmlehmwv87k5c",
        "code": "eosio.token",
        "quantity": "10.0000 EOS",
        "memo": "EOS tokens into wallet",
        "from": "`+session.actor+`",
        "publish_note": true
    },
    {
        "to": "za1myffclyc7d5k05q9tpd9kn74el0uljwhfycm0kxnqmpvv5qzcm8wezc70855rlsmlehmwv87k5c",
        "code": "thezeostoken",
        "quantity": "100.0000 ZEOS",
        "memo": "miau miau",
        "from": "`+session.actor+`",
        "publish_note": true
    },
    {
        "to": "za1myffclyc7d5k05q9tpd9kn74el0uljwhfycm0kxnqmpvv5qzcm8wezc70855rlsmlehmwv87k5c",
        "code": "atomicassets",
        "quantity": "1234567898765432",
        "memo": "This is my address: $SELF and this was the auth token: $AUTH0",
        "from": "`+session.actor+`",
        "publish_note": true
    }
]` : ""
    async function transact()
    {
        // fetch current fees
        let fee_table = await fetch_fee_table()
        console.log(fee_table)
        let tx_json = js_zsign_transfer_and_mint_transaction(
            desc_json,
            "thezeosalias@public",
            String(session.actor) + "@active",
            "zeos4privacy",
            fee_table.token_contract,
            JSON.stringify(fee_table.fees),
            mint_params_bytes
        )
        let tx_notes = JSON.parse(tx_json)
        console.log(tx_notes[0]) // tx
        console.log(tx_notes[1]) // notes
        // remove begin action in order to let the cosigner plugin prepend it again
        tx_notes[0].actions.shift()
        // cosign with thezeosalias public permission by prepending 'begin' action back
        const result = await session.transact(tx_notes[0], {
            transactPlugins: [
                new TransactPluginCosigner({
                    actor: 'thezeosalias',
                    permission: 'public',
                    privateKey: '5KUxZHKVvF3mzHbCRAHCPJd4nLBewjnxHkDkG8LzVggX4GtnHn6',
                    contract: 'thezeosalias',
                    action: 'begin',
                }),
            ]
        })
        console.log(result)
    }
    async function login()
    {
        const response = await sessionKit.login()
        setSession(response.session)
    }
    async function logout()
    {
        await sessionKit.logout(session)
        setSession(undefined)
    }
    useEffect(
        ()=>{
            async function restore()
            {
                setSession(await sessionKit.restore())
            }
            restore();
        },
        []  // empty dependency array => effect will only execute once
    )

    return (
        <div className="App">
            <div className="App-header">
                <img src={logo} className="App-logo" alt="logo" />
            </div>
            <div className="App-body">
                {session ? (
                    <div className='column'>
                        <h1>Welcome, {String(session.actor)}</h1>
                        <button onClick={logout}>Logout</button>
                        <textarea cols={100} rows={30} onChange={e => desc_json = e.target.value} defaultValue={desc_json}>
                        </textarea>
                        <button onClick={transact}>Transact</button>
                    </div>
                ) : (
                    <button onClick={login}>Login</button>
                )}
            </div>
        </div>
    );
}

export default App;
