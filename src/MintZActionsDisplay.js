import React, { useState, useEffect, useRef } from 'react';
import styles from './MintZActionsDisplay.module.scss';
import { Asset } from "@wharfkit/antelope";

function MintZActionsDisplay({ zactions, execute, rmDesc, clearTx, fees })
{
    return (
        <div className={styles.transaction}>
            <h3>Current Transaction</h3>
            <div className={styles.column}>
                {
                    zactions.map((action, i) => (
                        <div className={styles.action} key={i}>
                            <div>
                                <label htmlFor={"asset-"+i}>Asset:</label>
                                <div id={"asset-"+i} className={styles.data}>{action.quantity + '@' + action.contract}</div>
                            </div>
                            <div>
                                <label htmlFor={"address-"+i}>Address:</label>
                                <div id={"address-"+i} className={styles.data}>{action.to}</div>
                            </div>
                            <div>
                                <label htmlFor={"memo-"+i}>Memo:</label>
                                <div id={"memo-"+i} className={styles.data}>{action.memo}</div>
                            </div>
                            <div>
                                <button onClick={() => rmDesc(i)}>Remove</button>
                            </div>
                        </div>
                    ))
                }
            <div className={styles.column}>
            <div className={styles.row}>
                <button onClick={() => execute()}>Execute</button>
                <button onClick={() => clearTx()}>Clear</button>
            </div>
            <div><i>Transaction Fee: {
                new Asset(parseInt(Asset.fromString(fees.begin).units) + zactions.length * parseInt(Asset.fromString(fees.mint).units), Asset.fromString(fees.begin).symbol).toString()
            }</i></div>
            </div>
            </div>
        </div>
    )
}

export default MintZActionsDisplay;