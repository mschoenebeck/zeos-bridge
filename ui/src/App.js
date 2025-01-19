import logo from './logo.png';
import './App.scss';
import React, { useState, useEffect, useRef } from 'react';
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
import MintInputMask from './MintInputMask.js';
import MintZActionsDisplay from './MintZActionsDisplay.js';
window.Buffer = window.Buffer || require("buffer").Buffer; 


var symbols = [
    {
        name: "UOS",
        symbol: "8,UOS",
        contract: "eosio.token"
    },
    {
        name: "CLOAK",
        symbol: "4,CLOAK",
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
    //"https://test.ultra.eosusa.io"
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
    const [mintZActions, setMintZActions] = useState([]);
    const workerRef = useRef(null);
    const [feeTable, setFeeTable] = useState({
        token_contract: "thezeostoken",
        fees: {
            authenticate: "0.0000 ZEOS",
            begin: "0.0000 ZEOS",
            mint: "0.0000 ZEOS",
            output: "0.0000 ZEOS",
            publishnotes: "0.0000 ZEOS",
            spend: "0.0000 ZEOS",
            spendoutput: "0.0000 ZEOS",
            withdraw: "0.0000 ZEOS"
        }
    });

    useEffect(() => {
        // fetch current fees
        fetch_fee_table().then(val => {
            setFeeTable(val);
        });

        if(window.crossOriginIsolated)
        {
            console.log('App is running in cross-origin isolation. Multi-threading is enabled.');
        }
        else
        {
            console.warn('App is NOT running in cross-origin isolation. Multi-threading is disabled.');
            // TODO: show warning also in UI
        }
    }, []);

    async function transact()
    {
        // TODO: disable button
        workerRef.current = new Worker('/worker.js', { type: 'module' });
        workerRef.current.postMessage({ 
            actions: mintZActions,
            alias_authority: "thezeosalias@public",
            user_authority: String(session.auth.actor) + "@active",
            protocol_contract: "zeos4privacy",
            token_contract: feeTable.token_contract,
            fees: feeTable.fees
        });
        workerRef.current.onmessage = async (event) => {
            //console.log('Message from Worker:', event.data);
            let res = event.data.result;
            workerRef.current.terminate();
            // TODO: enable button

            // sign using Wharfkit
            // remove begin action in order to let the cosigner plugin prepend it again
            //res[0].actions.shift()
            // cosign with thezeosalias public permission by prepending 'begin' action back
            //const result = await session.transact(res[0], {
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

            // sign using Anchor Link
            const userSigned = await session.transact({actions: res[0].actions}, {broadcast: false});
            //console.log(userSigned);
            let tx = userSigned.transaction;
            tx.actions = res[0].actions;
            tx.expiration = tx.expiration.toString();
            tx.ref_block_num = tx.ref_block_num.toNumber();
            tx.ref_block_prefix = tx.ref_block_prefix.toNumber();
            tx.max_net_usage_words = tx.max_net_usage_words.toNumber();
            tx.max_cpu_usage_ms = tx.max_cpu_usage_ms.toNumber();
            tx.delay_sec = tx.delay_sec.toNumber();
            const signatureProvider = new JsSignatureProvider(['5KUxZHKVvF3mzHbCRAHCPJd4nLBewjnxHkDkG8LzVggX4GtnHn6']);
            const rpc = new JsonRpc('http://localhost:8888', { fetch });
            const api = new Api({ rpc, signatureProvider, chainId: "df0d1aacf71a6d61b11eee7b0e52cc54302b18f76346c7287f8c252a3de172f2", textDecoder: null, textEncoder: null });
            const aliasSigned = await api.transact(tx, { broadcast: false, sign: true, requiredKeys: ["EOS6XJ9dEWorNYR7xGHtagpq3JkJ5ts5NEP9WP46Nb5j97sf2yU9D"] });
            aliasSigned.signatures.push(userSigned.signatures[0].toString());
            //console.log(JSON.stringify(aliasSigned));
            const result = await api.pushSignedTransaction(aliasSigned);
            console.log(result);
        };
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
                            <MintZActionsDisplay zactions={mintZActions} execute={transact} rmDesc={rmMintDesc} clearTx={clearTx} fees={feeTable.fees} />
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
