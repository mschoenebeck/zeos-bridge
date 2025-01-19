import init_st, { js_zsign_transfer_and_mint_transaction as js_zsign_transfer_and_mint_transaction_st } from './wasm_pkg_st/zeos_caterpillar.js';
import init_mt, { initThreadPool, js_zsign_transfer_and_mint_transaction } from './wasm_pkg_mt/zeos_caterpillar.js';
//console.log("worker created...");

self.addEventListener('message', async (event) => {
    //console.log('Received data:', event.data);

    // fetch and decode mint params
    const fromB64String = (b64String) => Uint8Array.from(atob(b64String), c => c.charCodeAt(0))
    let mint_params = await (await fetch("./mint.params.b64")).text();
    let mint_params_bytes = fromB64String(mint_params);

    if(!self.crossOriginIsolated)
    {
        console.warn('Worker is NOT running in cross-origin isolation. Multi-threading is disabled.');

        // init single-threaded library wasm module
        await init_st();
    
        // create transaction and send it back to main thread (React App)
        self.postMessage({
            result: JSON.parse(js_zsign_transfer_and_mint_transaction_st(
                JSON.stringify(event.data.actions),
                event.data.alias_authority,
                event.data.user_authority,
                event.data.protocol_contract,
                event.data.token_contract,
                JSON.stringify(event.data.fees),
                mint_params_bytes
            ))
        });
    }
    else
    {
        console.log('Worker is running in cross-origin isolation. Multi-threading is enabled.');

        // init multi-threaded library wasm module
        await init_mt();
    
        // initialize thread pool with number of cores
        //console.log("thread num: " + navigator.hardwareConcurrency);
        await initThreadPool(navigator.hardwareConcurrency);
    
        // create transaction and send it back to main thread (React App)
        self.postMessage({
            status: 'Received',
            result: JSON.parse(js_zsign_transfer_and_mint_transaction(
                JSON.stringify(event.data.actions),
                event.data.alias_authority,
                event.data.user_authority,
                event.data.protocol_contract,
                event.data.token_contract,
                JSON.stringify(event.data.fees),
                mint_params_bytes
            ))
        });
    }
});


