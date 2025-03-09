import React, { useState, useEffect, useRef } from 'react';
import logo from './profile_cloak.png';
import cloakLogo from './profile_cloak.png';
import ultraLogo from './ultra-logo.png';
//import { SessionKit } from "@wharfkit/session";
//import { TransactPluginCosigner } from "@wharfkit/transact-plugin-cosigner";
//import { WebRenderer } from "@wharfkit/web-renderer";
//import { WalletPluginAnchor } from "@wharfkit/wallet-plugin-anchor";
import AnchorLink from 'anchor-link';
import AnchorLinkBrowserTransport from 'anchor-link-browser-transport';
import { Asset, Signature as AnchorSignature, SignedTransaction } from "@wharfkit/antelope";
import { Api, JsonRpc } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { PrivateKey, PublicKey, Signature } from 'eosjs/dist/eosjs-key-conversions';
//import MintInputMask from './MintInputMask.js';
//import MintZActionsDisplay from './MintZActionsDisplay.js';
window.Buffer = window.Buffer || require("buffer").Buffer; 

const CLOAK_TOKEN_CONTRACT = "1aa2aa3aa4pr";
const THEZEOSALIAS_CONTRACT = "1aa2aa3aa4pm"
const ZEOS4PRIVACY_CONTRACT = "1aa2aa3aa4pl"
const TOKEN_CONTRACTS = [
    "eosio.token",
    CLOAK_TOKEN_CONTRACT
];

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
    "https://ultratest-api.eoseoul.io",
    "https://ultratest.api.eosnation.io",
    //"https://testnet.ultra.eosrio.io", // cors disabled
    "https://test.ultra.eosusa.io",
    "https://api.ultra-testnet.cryptolions.io",
    "https://api.testnet.ultra.eossweden.org"
];
var _nodeIndex = 0;
const nextNode = () => apiNodes[_nodeIndex++ % apiNodes.length];
// source: https://stackoverflow.com/a/39914235/2340535
const sleep = ms => new Promise(r => setTimeout(r, ms));
// if an API node can't be reached because of, for instance, network issues then fetchChainApiJson() will keep looping
// the try/catch and tr different API nodes until the any node becomes reachable again.
// source: https://stackoverflow.com/a/13239999/2340535
export async function fetchChainApiJson(path, body = {}, headers = {}, parse = async (res) => await res.json())
{
    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';
    let retryDelay = 50;
    let maxDelay = 1000;
    let timeout = 15000;
    let maxRetries = apiNodes.length
    for(let i = 0; i < maxRetries; ++i)
    {
        let node = nextNode();
        try
        {
            const response = await fetch(node + path, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(timeout)
            });
            return await parse(response);
        }
        catch(err)
        {
            console.error(`Error in fetchChainApiJson(${node + path}): ` , err);
            console.log("Retry in " + retryDelay + "ms");
            await sleep(retryDelay);
            retryDelay = Math.min(retryDelay * 2, maxDelay);
        }
    }
}

async function fetchJson(url, body = {}, headers = {}, parse = async (res) => await res.json())
{
    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';
    let timeout = 15000;
    try
    {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout)
        });
        return await parse(response);
    }
    catch(err)
    {
        console.error(`Error in fetchJson(${url}): ` , err);
        return { status: 'error', message: err };
    }
}

async function fetchFeeTable()
{
    try
    {
        // fetch info from chain
        const res = await fetchChainApiJson('/v1/chain/get_table_rows', {
            code: THEZEOSALIAS_CONTRACT,
            table: 'fees',
            scope: THEZEOSALIAS_CONTRACT,
            lower_bound: 0,
            json: true
        });
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
}

async function fetchBalances(account)
{
    let balances = [];
    for(const contract of TOKEN_CONTRACTS)
    {
        try
        {
            // fetch info from chain
            const response = await fetchChainApiJson('/v1/chain/get_table_rows', {
                code: contract,
                table: 'accounts',
                scope: account,
                limit: 100,
                json: true
            });
            if(Object.hasOwn(response, 'error'))
            {
                console.log(response);
                return null; // TODO: should throw
            }
            balances = balances.concat(response.rows.map(row => {
                const dt = row.balance.indexOf('.');
                const ws = row.balance.indexOf(' ');
                const sc = row.balance.substr(ws + 1);
                return {
                    symbolCode: sc,
                    symbol: (dt === -1 ? '0' : String(ws - (dt + 1))) + ',' + sc,
                    contract,
                    balance: row.balance
                };
            }))
        }
        catch(err)
        {
            console.log(err.message);
            throw err.message;
        }
    }
    return balances;
}

function App()
{
    const [session, setSession] = useState(null);
    const [balances, setBalances] = useState([]);
    const [mintZActions, setMintZActions] = useState([]);
    const [buttonDisabled, setButtonDisabled] = useState(false);
    const workerRef = useRef(null);
    const [feeTable, setFeeTable] = useState({
        token_contract: CLOAK_TOKEN_CONTRACT,
        fees: {
            authenticate: "0.0000 CLOAK",
            begin: "0.0000 CLOAK",
            mint: "0.0000 CLOAK",
            output: "0.0000 CLOAK",
            publishnotes: "0.0000 CLOAK",
            spend: "0.0000 CLOAK",
            spendoutput: "0.0000 CLOAK",
            withdraw: "0.0000 CLOAK"
        }
    });

    const addressRef = useRef(null);
    const symbolRef = useRef(null);
    const amountRef = useRef(null);
    const memoRef = useRef(null);

    function verifyAdd(desc)
    {
        // address validity checks
        if(desc.to.length !== 78)
        {
            alert("address length must be 78")
            return
        }
        if(desc.to.substr(0, 3) !== "za1")
        {
            alert("address must start with 'za1'")
            return
        }
        if(!/^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]*$/.test(desc.to.substr(3)))
        {
            alert("address contains invalid characters")
            return
        }

        // amount validity check
        if(desc.quantity === "")
        {
            alert("invalid amount")
            return
        }

        desc.quantity = Asset.fromFloat(parseFloat(desc.quantity), Asset.Symbol.from(balances[symbolRef.current.value].symbol)).toString();
        setMintZActions([...mintZActions, desc]);
    }

    function clear()
    {
        addressRef.current.value = "";
        amountRef.current.value = "";
        memoRef.current.value = "";
    }

    function maskString(str, startLength = 8, endLength = 6)
    {
        if(str.length <= startLength + endLength) return str;
        const start = str.slice(0, startLength);
        const end = endLength >0 ? str.slice(-endLength) : "";
        return `${start}...${end}`;
    }

    async function login()
    {
        //const response = await sessionKit.login();
        //setSession(response.session);

        //const identity = await link.login('mydapp');
        //setSession(identity.session);

        if('ultra' in window)
        {
            window.ultra.connect().then(async (res) => {
                if(res.status === "success")
                {
                    //let cid = (await window.ultra.getChainId()).data;
                    //if(cid === chain.id)
                    //{
                        // session[0] -> actor, session[1] -> permission
                        //session = res.data.blockchainid.split('@');
                        setSession(res.data.blockchainid.split('@'));
                    //}
                    //else
                    //{
                    //    console.log("wrong chain ID: has " + cid + " expected: " + chain.id);
                    //}
                }
                else
                {
                    console.log(res.message);
                }
            });
        }
        else
        {
            console.log("Ultra Wallet Plugin not intalled.");
            alert("Ultra Wallet Plugin not intalled.");
            window.open("https://chromewebstore.google.com/detail/ultra-wallet/kjjebdkfeagdoogagbhepmbimaphnfln", "_blank");
        }
    }

    async function logout()
    {
        //await sessionKit.logout(session);
        //session.
        setSession(null);
    }

    useEffect(() => {
        async function restore()
        {
            //setSession(await sessionKit.restore());
            //setSession(await link.restoreSession('mydapp'));
            if('ultra' in window)
            {
                const res = await window.ultra.connect({ onlyIfTrusted: true });
                if(res.status === "success")
                {
                    // session[0] -> actor, session[1] -> permission
                    setSession(res.data.blockchainid.split('@'));
                }
                else
                {
                    console.log(res.message);
                }
            }
            else
            {
                console.log("Ultra Wallet Plugin not intalled.");
            }
        }
        restore();

        // fetch current fees
        fetchFeeTable().then(val => {
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

    useEffect(() => {
        if(session) fetchBalances(session[0]).then(bals => setBalances(bals));
        else setBalances([]);
    }, [session]);

    async function transact()
    {
        // disable button and show loading cursor
        setButtonDisabled(true);
        document.body.style.cursor = 'wait';

        workerRef.current = new Worker('/worker.js', { type: 'module' });
        workerRef.current.postMessage({ 
            actions: mintZActions,
            alias_authority: THEZEOSALIAS_CONTRACT + "@public",
            user_authority: /*String(session.auth.actor)*/session[0] + "@active",
            protocol_contract: ZEOS4PRIVACY_CONTRACT,
            token_contract: feeTable.token_contract,
            fees: feeTable.fees
        });
        workerRef.current.onmessage = async (event) => {
            console.log('Message from Worker:', event.data);
            let res = event.data.result;
            workerRef.current.terminate();

            // enable button and resume normal cursor
            setButtonDisabled(false);
            document.body.style.cursor = 'default';

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
            //const userSigned = await session.transact({actions: res[0].actions}, {broadcast: false});
            ////console.log(userSigned);
            //let tx = userSigned.transaction;
            //tx.actions = res[0].actions;
            //tx.expiration = tx.expiration.toString();
            //tx.ref_block_num = tx.ref_block_num.toNumber();
            //tx.ref_block_prefix = tx.ref_block_prefix.toNumber();
            //tx.max_net_usage_words = tx.max_net_usage_words.toNumber();
            //tx.max_cpu_usage_ms = tx.max_cpu_usage_ms.toNumber();
            //tx.delay_sec = tx.delay_sec.toNumber();
            //const signatureProvider = new JsSignatureProvider(['5KUxZHKVvF3mzHbCRAHCPJd4nLBewjnxHkDkG8LzVggX4GtnHn6']);
            //const rpc = new JsonRpc('http://localhost:8888', { fetch });
            //const api = new Api({ rpc, signatureProvider, chainId: "df0d1aacf71a6d61b11eee7b0e52cc54302b18f76346c7287f8c252a3de172f2", textDecoder: null, textEncoder: null });
            //const aliasSigned = await api.transact(tx, { broadcast: false, sign: true, requiredKeys: ["EOS6XJ9dEWorNYR7xGHtagpq3JkJ5ts5NEP9WP46Nb5j97sf2yU9D"] });
            //aliasSigned.signatures.push(userSigned.signatures[0].toString());
            ////console.log(JSON.stringify(aliasSigned));
            //const result = await api.pushSignedTransaction(aliasSigned);
            //console.log(result);

            // sign using Ultra Wallet Plugin
            const keyMap = {
                account: "contract",
                name: "action",
                authorization: "authorizations"
            };
            let ultraActions = res[0].actions.map(obj => {
                const transformedObj = Object.fromEntries(
                    Object.entries(obj).map(([key, value]) => [keyMap[key] || key, value])
                );
                // Transform the 'authorizations' array if it exists
                if (transformedObj.authorizations) {
                    transformedObj.authorizations = transformedObj.authorizations.map(auth => `${auth.actor}@${auth.permission}`);
                }
                return transformedObj;
            });
            console.log(ultraActions);
            let userSigned;
            try {
                userSigned = await window.ultra.signTransaction(ultraActions, {signOnly: true});
            }  catch (error) {
                console.error("Error signing transaction:", error);
                // Access the error message
                if (error && error.message) {
                  console.log("Error message:", error.message);
                } else {
                  console.log("Unknown error:", error);
                }
            }
            console.log(userSigned);
            let tx = userSigned.data;
            tx.actions = res[0].actions;
            const signatureProvider = new JsSignatureProvider(['5KUxZHKVvF3mzHbCRAHCPJd4nLBewjnxHkDkG8LzVggX4GtnHn6']);
            const rpc = new JsonRpc(nextNode(), { fetch });
            const api = new Api({ rpc, signatureProvider, chainId: "7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9", textDecoder: null, textEncoder: null });
            const aliasSigned = await api.transact(tx, { broadcast: false, sign: true, requiredKeys: ["EOS6XJ9dEWorNYR7xGHtagpq3JkJ5ts5NEP9WP46Nb5j97sf2yU9D"] });
            aliasSigned.signatures.push(userSigned.data.signatures[0].toString());
            console.log(JSON.stringify(aliasSigned));
            const result = await api.pushSignedTransaction(aliasSigned);
            console.log(result);

            // update balances
            fetchBalances(session[0]).then(bals => setBalances(bals));
        };
    }

    return (
        <div className="App fullscreen-background">
            <div className="App-header">
                <div id="app-info">
                    <img src={logo} className="App-logo" alt="logo" />
                    <h2>CLOAK Bridge</h2>
                    {/* <div>Transfer Assets into the Shielded Protocol</div> */}
                </div>
                {session ? <>
                    <button className="btn-default" onClick={() => fetchJson('/faucet', { account: session[0] }).then(res => { console.log(res); alert(res.status); fetchBalances(session[0]).then(bals => setBalances(bals)); })}>CLOAK Faucet</button>
                    <div id="user-info">
                        <label htmlFor="logout-button">Welcome, {/*String(session.auth.actor)*/session[0]}</label>
                        <button id="logout-button" className="btn-default" onClick={logout}>Logout</button>
                    </div>
                </> : <></>}
            </div>
            <div className="d-flex flex-column align-items-center justify-content-center gap-3 App-body">
                {session ? <>
                    <div className="col-lg-4 col-md-6 col-sm-12">
                        <div className="mim-container p-3">
                            <h3>Add Asset</h3>
                            <div className="d-flex flex-column gap-2 text-start mb-2">
                                <div>
                                    <label htmlFor="address-input">Address:</label>
                                    <input type="text" id="address-input" name="address" ref={addressRef} />
                                </div>
                                <div>
                                    <label htmlFor="symbol-select">Symbol:</label>
                                    <select name="symbol" id="symbol-select" ref={symbolRef}>
                                        {balances && balances.map((bal, i) => (<option key={i} value={i}>{bal.balance + '@' + bal.contract}</option>))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="amount-input">Amount:</label>
                                    <input type="number" id="amount-input" name="amount" ref={amountRef} />
                                </div>
                                <div>
                                    <label htmlFor="memo-input">Private Memo:</label>
                                    <textarea id="memo-input" name="memo" rows="10" ref={memoRef} />
                                </div>
                            </div>
                            <div className="d-flex align-items-center justify-content-center gap-2">
                                <button className='btn-l' disabled={buttonDisabled} onClick={() => clear()}>Clear</button>
                                <button className='btn-l' disabled={buttonDisabled} onClick={() => verifyAdd({
                                    to: addressRef.current.value,
                                    contract: balances[symbolRef.current.value].contract,
                                    quantity: amountRef.current.value,
                                    memo: memoRef.current.value,
                                    from: /*String(session.auth.actor)*/session[0],
                                    publish_note: true
                                })}>Add</button>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 d-flex flex-column align-items-center gap-4">
                        {mintZActions.length > 0 &&
                            <div className='d-flex align-items-center no-wrap gap-3'>
                                <div className='col-2 d-flex flex-column align-items-center gap-3'>
                                    <img src={ultraLogo} width={128} />
                                    <h1>Ultra Account</h1>
                                </div>
                                <div className="col-8 flexbox-row">
                                    <div className="trail">
                                        <div className="d-flex flex-column align-items-center gap-3">
                                            <div className="d-flex align-items-center no-wrap gap-3 flex-wrap">
                                            {mintZActions.map((action, i) => (
                                                <div className="action" key={i}>
                                                    <div style={{display: "flex", justifyContent: "space-between", alignItems: 'start'}}>
                                                        <div>
                                                            <label htmlFor={"address-"+i}>Recipient:</label>
                                                            <div id={"address-"+i} className="data" title={action.to}>{maskString(action.to)}</div>
                                                        </div>
                                                        <button className="btn-default" onClick={() => { mintZActions.splice(i, 1); setMintZActions([...mintZActions]); }}>X</button>
                                                    </div>
                                                    <div>
                                                        <label htmlFor={"asset-"+i}>Asset:</label>
                                                        <div id={"asset-"+i} className="data">{action.quantity + '@' + action.contract}</div>
                                                    </div>
                                                    <div>
                                                        <label htmlFor={"memo-"+i}>Memo:</label>
                                                        <div id={"memo-"+i} className="data" title={action.memo}>{maskString(action.memo, 50, 0)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="chevron"></div>
                                </div>
                                <div className='col-2 d-flex flex-column align-items-center gap-3'>
                                    <img src={cloakLogo} width={128} />
                                    <h1>CLOAK Wallet</h1>
                                </div>
                            </div>
                        }
                        {mintZActions.length > 0 &&
                            <div className='d-flex flex-column align-items-center gap-3'>
                                <div className="d-flex align-items-center gap-3">
                                    <button className='btn-l' disabled={buttonDisabled} onClick={() => setMintZActions([])}>Clear</button>
                                    <button className='btn-l' disabled={buttonDisabled} onClick={() => transact()}>Execute</button>
                                </div>
                                <b>Transaction Fee: {new Asset(parseInt(Asset.fromString(feeTable.fees.begin).units) + mintZActions.length * parseInt(Asset.fromString(feeTable.fees.mint).units), Asset.fromString(feeTable.fees.begin).symbol).toString()}</b>
                            </div>
                        }
                    </div>
                </> : 
                    <button className="btn-l" onClick={login}>Login</button>
                }
            </div>
        </div>
    );
}

export default App;
