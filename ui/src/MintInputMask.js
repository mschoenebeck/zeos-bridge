import React, { useState, useEffect, useRef } from 'react';
import styles from './MintInputMask.module.scss';
import { Asset } from "@wharfkit/antelope";

function MintInputMask({ user, symbols, addMintDesc })
{
    const addressRef = useRef(null);
    const symbolRef = useRef(null);
    const amountRef = useRef(null);
    const memoRef = useRef(null);

    function verifyAdd(desc, addMintDesc)
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

        desc.quantity = Asset.fromFloat(parseFloat(desc.quantity), Asset.Symbol.from(symbols[symbolRef.current.value].symbol)).toString()
        addMintDesc(desc)
    }

    function clear()
    {
        addressRef.current.value = "";
        amountRef.current.value = "";
        memoRef.current.value = "";
    }

    return (
        <div className={styles.container}>
            <h3>Add Asset</h3>
            <div className={styles.column}>
                <div>
                    <label htmlFor="address-input">Address:</label>
                    <input type="text" id="address-input" name="address" ref={addressRef} />
                </div>
                <div>
                    <label htmlFor="symbol-select">Symbol:</label>
                    <select name="symbol" id="symbol-select" ref={symbolRef}>
                        {symbols.map((sym, i) => (<option key={i} value={i}>{sym.name + '@' + sym.contract}</option>))}
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
            <div className={styles.row}>
                <button id="add" onClick={() => verifyAdd({
                    to: addressRef.current.value,
                    contract: symbols[symbolRef.current.value].contract,
                    quantity: amountRef.current.value,
                    memo: memoRef.current.value,
                    from: user,
                    publish_note: true
                }, addMintDesc)}>Add</button>
                <button onClick={() => clear()}>Clear</button>
            </div>
        </div>
    );
}

export default MintInputMask;