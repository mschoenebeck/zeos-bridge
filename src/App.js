import logo from './logo.png';
import './App.scss';
import React, { useState, useEffect } from 'react';
//import { SessionKit } from "@wharfkit/session";
//import { TransactPluginCosigner } from "@wharfkit/transact-plugin-cosigner";
//import { WebRenderer } from "@wharfkit/web-renderer";
//import { WalletPluginAnchor } from "@wharfkit/wallet-plugin-anchor";
import AnchorLink from 'anchor-link';
import AnchorLinkBrowserTransport from 'anchor-link-browser-transport';
import { Signature as AnchorSignature, SignedTransaction } from "@wharfkit/antelope";
import { Api, JsonRpc } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { PrivateKey, PublicKey, Signature } from 'eosjs/dist/eosjs-key-conversions';
import params_min_b64 from './params_mint.b64';
import init, { js_zsign_transfer_and_mint_transaction } from './pkg_st/zeos_caterpillar.js';
import MintInputMask from './MintInputMask.js';
import MintZActionsDisplay from './MintZActionsDisplay.js';
window.Buffer = window.Buffer || require("buffer").Buffer; 

await init();

const fromB64String = (b64String) => Uint8Array.from(atob(b64String), c => c.charCodeAt(0))
let mint_params_bytes;
fetch(params_min_b64).then(r => r.text()).then(text => {
    mint_params_bytes = fromB64String(text)
    //console.log(mint_params_bytes)
});

var symbols = [
    {
        name: "EOS",
        symbol: "4,EOS",
        contract: "eosio.token"
    },
    {
        name: "ZEOS",
        symbol: "4,ZEOS",
        contract: "thezeostoken"
    },
    {
        name: "NFT",
        symbol: "0,",
        contract: "atomicassets"
    }
]

//const webRenderer = new WebRenderer();
//const sessionKit = new SessionKit({
//    appName: "appname",
//    chains: [
//        {
//        id: "df0d1aacf71a6d61b11eee7b0e52cc54302b18f76346c7287f8c252a3de172f2",
//        url: "http://localhost:8888",
//        },
//    ],
//    ui: webRenderer,
//    walletPlugins: [new WalletPluginAnchor()]
//});
const transport = new AnchorLinkBrowserTransport();
const link = new AnchorLink({
    transport,
    chains: [
        {
            chainId: 'df0d1aacf71a6d61b11eee7b0e52cc54302b18f76346c7287f8c252a3de172f2',
            nodeUrl: 'http://localhost:8888',
        },
    ],
});

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
// fetch current fees
var fee_table = await fetch_fee_table()
//console.log(fee_table)

function App()
{
    const [session, setSession] = useState(undefined);
    const [mintZActions, setMintZActions] = useState([]);
    async function transact()
    {
        //let fee_table = await fetch_fee_table()
        //console.log(fee_table)
        let tx_json = js_zsign_transfer_and_mint_transaction(
            JSON.stringify(mintZActions),
            "thezeosalias@public",
            //String(session.actor) + "@active",
            String(session.auth.actor) + "@active",
            "zeos4privacy",
            fee_table.token_contract,
            JSON.stringify(fee_table.fees),
            mint_params_bytes
        )
        let tx_notes = JSON.parse(tx_json)
        console.log(tx_notes[0]) // tx
        console.log(tx_notes[1]) // notes
        // remove begin action in order to let the cosigner plugin prepend it again
        //tx_notes[0].actions.shift()
        // cosign with thezeosalias public permission by prepending 'begin' action back
        //const result = await session.transact(tx_notes[0], {
        //    transactPlugins: [
        //        new TransactPluginCosigner({
        //            actor: 'thezeosalias',
        //            permission: 'public',
        //            privateKey: '5KUxZHKVvF3mzHbCRAHCPJd4nLBewjnxHkDkG8LzVggX4GtnHn6',
        //            contract: 'thezeosalias',
        //            action: 'begin',
        //        }),
        //    ]
        //});
        const userSigned = await session.transact({actions: tx_notes[0].actions}, {broadcast: false});
        //console.log(userSigned);
        let tx = userSigned.transaction;
        tx.actions = tx_notes[0].actions;
        tx.expiration = tx.expiration.toString();
        tx.ref_block_num = tx.ref_block_num.toNumber();
        tx.ref_block_prefix = tx.ref_block_prefix.toNumber();
        tx.max_net_usage_words = tx.max_net_usage_words.toNumber();
        tx.max_cpu_usage_ms = tx.max_cpu_usage_ms.toNumber();
        tx.delay_sec = tx.delay_sec.toNumber();
        const signatureProvider = new JsSignatureProvider(['5KUxZHKVvF3mzHbCRAHCPJd4nLBewjnxHkDkG8LzVggX4GtnHn6']);
        const rpc = new JsonRpc('http://localhost:8888', { fetch });
        const api = new Api({ rpc, signatureProvider, chainId: "df0d1aacf71a6d61b11eee7b0e52cc54302b18f76346c7287f8c252a3de172f2", textDecoder: null, textEncoder: null });
        const aliasSigned = await api.transact(tx, {broadcast: false, sign: true, requiredKeys: ["EOS6XJ9dEWorNYR7xGHtagpq3JkJ5ts5NEP9WP46Nb5j97sf2yU9D"] });
        aliasSigned.signatures.push(userSigned.signatures[0].toString());
        //console.log(aliasSigned);
        const result = await api.pushSignedTransaction(aliasSigned);
        console.log(result);
    }
    async function login()
    {
        //const response = await sessionKit.login();
        //setSession(response.session);
        const identity = await link.login('mydapp');
        setSession(identity.session);
    }
    async function logout()
    {
        //await sessionKit.logout(session);
        //session.
        setSession(undefined);
    }
    useEffect(
        ()=>{
            async function restore()
            {
                //setSession(await sessionKit.restore());
                setSession(await link.restoreSession('mydapp'));
                console.log(PrivateKey.fromString('5KFqPVuc9BbnWtYbFFKK339z4oQ68RAZXfwB6SwoBJH2DnfUX3D').toString());
            }
            restore();
        },
        []  // empty dependency array => effect will only execute once
    )
    function addMintDesc(desc)
    {
        setMintZActions([...mintZActions, desc])
    }
    function rmMintDesc(index)
    {
        mintZActions.splice(index, 1)
        setMintZActions([...mintZActions])
    }
    function clearTx()
    {
        setMintZActions([])
    }

    return (
        <div className="App">
            <div className="App-header">
                <img src={logo} className="App-logo" alt="logo" />
                <div id='app-info'>
                    <h1>ZEOS Bridge</h1>
                    <div>Transfer Assets into the Shielded Protocol</div>
                </div>
                {session ? (
                    <div className='column' id="user-info">
                        <label htmlFor="logout-button">Welcome, {String(session.auth.actor)}</label>
                        <button id="logout-button" onClick={logout}>Logout</button>
                    </div>
                ) : (<></>)}
            </div>
            <div className="App-body">
                {session ? (
                    <div className='column'>
                        <div className='row'>
                            <MintInputMask user={String(session.auth.actor)} symbols={symbols} addMintDesc={addMintDesc} />
                            <MintZActionsDisplay zactions={mintZActions} execute={transact} rmDesc={rmMintDesc} clearTx={clearTx} fees={fee_table.fees} />
                        </div>
                    </div>
                ) : (
                    <button onClick={login}>Login</button>
                )}
            </div>
        </div>
    );
}

export default App;
