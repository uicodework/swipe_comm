import { OrderEventData, TaskCommandData } from "swipelime-client-node";
import { getserviceHandler, startService } from "..";
import { json } from "body-parser";

var express = require('express');
const mysql = require('mysql');

let pool =
    mysql.createPool({
        connectionLimit: 100, //important
        host: process.env['MYSQL_HOST'],
        user: process.env['MYSQL_USER'],
        password: process.env['MYSQL_PASSW'],
        database: process.env['MYSQL_DB'],
        debug: false
    });

const router = express();

router.get('/', (req: any, res: any) => {
    console.log(process.env['MYSQL_HOST']);
    getMySQLInfo().then((ret) => {
        res.json(ret);
    });
    //res.send(process.env['MYSQL_DB']);
});

router.post('/', (req: any, res: any) => {
    const { command, data } = req.body;
    console.log(process.env['MYSQL_HOST']);
    console.log(command);
    console.log(data);
    //console.log(req.body);

    if (command === 'finishTable') {
        const { asztal } = data;
        console.log("Zárni: " + asztal);
        getserviceHandler().finishTable({ externalId: asztal }).then((res) => {
            console.log("Finish table");
            console.log(res);
        }).catch((err) => {
            console.log("Finish table HIBA");
            console.log(err);
        });
        res.json({ status: 'SUCCESS' });

    } else if (command === 'upsertUniversalMenuItems') {
        getserviceHandler().upsertUniversalMenuItems(data).then((res) => {
            console.log("upsertUniversalMenuItems");
            console.log(res);
        });
        res.json({ status: 'SUCCESS' });
    }
    else if (command === 'isready') {
        try {
            getserviceHandler().isReady().then((ret) => {
                res.json({ status: 'OK' });
            });
        }
        catch (error) {
            res.json({ status: 'ERROR' });
            console.error(error);
        }
        //  getserviceHandler().getUniversalMenuCategories().then((ret) => {
        //      console.log(ret);
        //  });
    }
    else if (command === 'start') {
        //console.log(data.MYSQL_DB);
        process.env['SWIPELIME_USERNAME'] = data.SWIPELIME_USERNAME;
        process.env['SWIPELIME_PASSWORD'] = data.SWIPELIME_PASSWORD;
        process.env['SWIPELIME_TENANT'] = data.SWIPELIME_TENANT;
        process.env['SWIPELIME_ENVIRONMENT'] = data.SWIPELIME_ENVIRONMENT;
        process.env['SWIPELIME_NYELV'] = data.SWIPELIME_NYELV;
        process.env['MYSQL_DB'] = data.MYSQL_DB;
        process.env['MYSQL_USER'] = data.MYSQL_USER;
        process.env['MYSQL_PASSW'] = data.MYSQL_PASSW;
        process.env['MYSQL_HOST'] = data.MYSQL_HOST;

        pool = mysql.createPool({
            connectionLimit: 100, //important
            host: process.env['MYSQL_HOST'],
            user: process.env['MYSQL_USER'],
            password: process.env['MYSQL_PASSW'],
            database: process.env['MYSQL_DB'],
            debug: false
        });

        dbvaltozas();

        startService().then((ret) => res.send(ret)).catch((ret) => { console.log(ret) });

        //res.send("OK");
    }
    else if (command === 'upsertTables') {
        try {
            getserviceHandler().upsertTables(data).then((ret) => {
                console.log("upsertTables");
                console.log(ret);
                res.send(ret);
            });
        }
        catch (error) {
            console.log(error);
            res.send("Hiba");
        }
    }
    else if (command === 'addCustomOrderItem') {
        getserviceHandler().addCustomOrderItem({ externalId: data.asztal },
            { label: data.label, quantity: data.quantity, price: data.price }).then((ret) => {
                console.log("addCustomOrderItem");
                console.log(ret);
                res.send(ret);
            });
    }


});

router.get('/addCustomOrderItem', (req: any, res: any) => {

    getserviceHandler().addCustomOrderItem({ externalId: "01" }, { label: { hu: "Cola" }, quantity: 1, price: 1000 }).then((res) => {
        console.log("addCustomOrderItem");
        console.log(res);
    });
    res.send("OK");
});

router.get('/asztalzar', (req: any, res: any) => {
    getserviceHandler().finishTable({ externalId: "01" }).then((res) => {
        console.log("Finish table");
        console.log(res);
    });
    res.send("OK");
});

async function getMySQLInfo() {

    return new Promise((resolve, reject) => {
        pool.getConnection((err: any, connection: any) => {
            if (err) throw err;

            connection.query("show variables where value<>''", (err: any, rows: any) => {
                connection.release(); // return the connection to pool
                if (err) {
                    reject(err);
                } else {
                    // console.log(rows);
                    resolve(rows)
                }
            });
        });

    })

}



export function SqlExecute(sql: string) {
    try {
        console.log('SqlExecute: ' + sql);

        pool.getConnection((err: any, connection: any) => {
            if (err) throw err;

            connection.query(sql, (err: any, rows: any) => {
                connection.release(); // return the connection to pool
                if (err)
                    console.error("SqlExecute: " + err);
                else
                    console.log(`Rows: ${rows.affectedRows}`);
            });
        });
    } catch (e) {
        console.error("SqlExecute error:" + (e as Error).message);
    }
}

export async function SqlExec(sql: string) {
    try {
        return new Promise((resolve, reject) => {
            console.log('SqlExec: ' + sql);

            pool.getConnection((err: any, connection: any) => {
                if (err) throw err;

                connection.query(sql, (err: any, rows: any) => {
                    connection.release(); // return the connection to pool
                    if (err) {
                        console.error("SqlExec: " + err);
                        reject(err);
                    } else {
                        // console.log(rows);
                        console.log(`Rows: ${rows.affectedRows}`);
                        resolve(rows);
                    }
                });
            });

        })
    } catch (e) {
        console.error("SqlExec error:" + (e as Error).message);
    }

}

export async function SqlInsert(sql: string) {
    try {
        return new Promise<number>((resolve, reject) => {
            console.log('SqlInsert: ' + sql);
            pool.getConnection((err: any, connection: any) => {
                if (err) throw err;

                connection.query(sql, (err: any, rows: any) => {

                    connection.release(); // return the connection to pool
                    if (err) {
                        console.error("SqlExec: " + err);
                        reject(err);
                    } else {
                        // console.log(rows);
                        console.log(`Inserted ID: ${rows.insertId}`);
                        resolve(rows.insertId);
                    }
                });
            });

        })
    } catch (e) {
        console.error("SqlInsert error:" + (e as Error).message);
    }

}

export function SqlOneValue(field: string, table: string, where: string) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err: any, connection: any) => {
            if (err) throw err;
            let sql = `select ${field}`;

            if (table.length > 0) {
                sql += ` from ${table}`;
            }
            if (where.length > 0) {
                sql += " where " + where;
            }
            console.log("SqlOneValue: " + sql);
            connection.query(sql, (err: any, rows: any, fields: any) => {

                connection.release(); // return the connection to pool
                if (err) {
                    reject(err);
                } else {
                    //
                    console.log(rows);
                    // console.log(fields);
                    // console.log(fields[0].name);
                    let ret = '';
                    if (rows.length > 0) {
                        ret = rows[0][fields[0].name]
                    }
                    resolve(ret);
                }
            });
        });

    })

}

export function SqlOneValueDbl(field: string, table: string, where: string) {
    return new Promise<number>((resolve, reject) => {
        pool.getConnection((err: any, connection: any) => {
            if (err) throw err;
            let sql = `select ${field}`;

            if (table.length > 0) {
                sql += ` from ${table}`;
            }
            if (where.length > 0) {
                sql += " where " + where;
            }
            console.log("SqlOneValueDbl: " + sql);
            connection.query(sql, (err: any, rows: any, fields: any) => {

                connection.release(); // return the connection to pool
                if (err) {
                    reject(err);
                } else {
                    //
                    console.log(rows);
                    // console.log(fields);
                    // console.log(fields[0].name);
                    let ret = 0.0;
                    if (rows.length > 0) {
                        ret = rows[0][fields[0].name]
                    }
                    resolve(ret);
                }
            });
        });

    })
}


export async function SqlOneValueStr__(sql: string) {
    pool.getConnection((err: any, connection: any) => {
        if (err) throw err;

        connection.promise().query(sql)
            .then((rows: any, fields: any) => {
                const ret = rows[0][fields];
                return ret;
            })
            .catch(console.log)
    });
}

export function newOrderBulk(order: OrderEventData) {
    try {
        console.log("Új rendelés");
        console.log("Asztal: " + order.tableData.externalId);
        order.orderItems[2].customerData.position
        let asztal = order.tableData.externalId;
        let values: any[][] = [];

        if (asztal != undefined) {
            SqlExecute("update asztalok set statusz='nyitott', nyito='SWIPE' " +
                " where asztalszam='" + asztal + "'" +
                "  and statusz='zart'");

            order.orderItems.forEach(r => {

                if (r.variantData == undefined) {
                    let cikkkod = r.menuItemData.externalId ?? "";
                    let mennyiseg = r.quantity;
                    let swipeid = r.orderItemId;
                    let uzenet = r.additionalRequests;
                    let szek = r.customerData.position;
                    if ((szek < 0) || (szek > 99)) {
                        szek = 1;
                    }
                    if (uzenet == undefined) {
                        uzenet = "";
                    }
                    if (cikkkod.length > 0) {
                        while (mennyiseg > 0) {
                            values.push([cikkkod, 1, "SWIPE", 0, 0, asztal, szek, "", "I", uzenet, swipeid]);
                            mennyiseg--;
                        }
                    } else {
                        console.log("Nincs GTSG azonosító megadva a cikknél!");
                    }
                } else {
                    let cikkkod = r.variantData.externalId ?? "";
                    let mennyiseg = r.quantity;
                    let uzenet = r.additionalRequests;
                    let swipeid = r.orderItemId;
                    let szek = r.customerData.position;
                    if ((szek < 0) || (szek > 99)) {
                        szek = 1;
                    }

                    if (uzenet == undefined) {
                        uzenet = "";
                    }
                    if (cikkkod.length > 0) {
                        while (mennyiseg > 0) {
                            values.push([cikkkod, 1, "SWIPE", 0, 0, asztal, szek, "", "I", uzenet, swipeid]);
                            mennyiseg--;
                        }
                    } else {
                        console.log("Nincs GTSG azonosító megadva a variansnál!");
                    }

                }
                if (r.selectablesData != undefined) {
                    r.selectablesData.forEach(s => {
                        let cikkkod = s.externalId ?? "";
                        let mennyiseg = r.quantity;
                        let swipeid = r.orderItemId;
                        let uzenet = r.additionalRequests;
                        if (uzenet == undefined) {
                            uzenet = "";
                        }
                        let szek = r.customerData.position;
                        if ((szek < 0) || (szek > 99)) {
                            szek = 1;
                        }
                        if (cikkkod.length > 0) {
                            while (mennyiseg > 0) {
                                values.push([cikkkod, 1, "SWIPE", 0, 0, asztal, szek, "", "I", uzenet, swipeid]);
                                mennyiseg--;
                            }
                        } else {
                            console.log("Nincs GTSG azonosító megadva a selectables-nél!");
                        }
                    });
                }
            });

            if (values.length > 0) {
                let sql = "insert into rendelesek (cikkkod,mennyiseg,kezelokod,ar,brutto,asztalkod,szek,datum,kedvezmenyezheto, uzenet, kulsoid) values ? ";
                console.log("newOrderBulk: " + sql);
                console.log(JSON.stringify(values, null, 2));
                pool.getConnection((err: any, connection: any) => {
                    if (err) throw err;

                    connection.query(sql, [values], (err: any, rows: any) => {
                        connection.release(); // return the connection to pool
                        if (err == undefined) {
                            console.log(`Rows: ${rows.affectedRows}`);
                        }
                        else {
                            console.error("MySQL error:" + err);
                        }
                    });
                });
            }

        } else {
            console.log("Nincs GTSG azonosító megadva az asztalnál!");
        }
    } catch (e) {
        console.error("newOrderBulk error:" + (e as Error).message);
    }
}

export function newOrder(order: OrderEventData) {
    console.log("Új rendelés");
    console.log("Asztal: " + order.tableData.externalId);
    try {
        let asztal = order.tableData.externalId;
        if (asztal != undefined) {
            SqlExecute("update asztalok set statusz='nyitott', nyito='SWIPE' " +
                " where asztalszam='" + asztal + "'" +
                "  and statusz='zart'");
            let sorrend = 0;
            order.orderItems.forEach(r => {
                sorrend++;
                if (r.variantData == undefined) {
                    let cikkkod = r.menuItemData.externalId;
                    let mennyiseg = r.quantity;
                    let uzenet = r.additionalRequests;
                    if (uzenet == undefined) {
                        uzenet = "";
                    }
                    if (cikkkod != undefined) {
                        let sql = `insert into rendelesek (cikkkod,mennyiseg,kezelokod,ar,brutto,asztalkod,szek,datum,kedvezmenyezheto,uzenet,sorrend) ` +
                            ` values( ${cikkkod}, ${mennyiseg}, "SWIPE", 0, 0, "${asztal}", 1, "", "I", ${mysql.escape(uzenet)}, ${sorrend} ) `;

                        SqlExecute(sql);
                    } else {
                        console.log("Nincs GTSG azonosító megadva a cikknél!");
                    }
                } else {
                    let cikkkod = r.variantData.externalId;
                    let mennyiseg = r.quantity;
                    let uzenet = r.additionalRequests;
                    if (uzenet == undefined) {
                        uzenet = "";
                    }
                    if (cikkkod != undefined) {
                        let sql = `insert into rendelesek (cikkkod,mennyiseg,kezelokod,ar,brutto,asztalkod,szek,datum,kedvezmenyezheto, uzenet,sorrend) ` +
                            ` values( ${cikkkod}, ${mennyiseg}, "SWIPE", 0, 0, "${asztal}", 1, "", "I", ${mysql.escape(uzenet)}, ${sorrend}) `;

                        SqlExecute(sql);
                    } else {
                        console.log("Nincs GTSG azonosító megadva a variansnál!");
                    }

                }
                if (r.selectablesData != undefined) {
                    r.selectablesData.forEach(s => {
                        let cikkkod = s.externalId;
                        let mennyiseg = r.quantity;
                        let uzenet = r.additionalRequests;
                        if (uzenet == undefined) {
                            uzenet = "";
                        }
                        if (cikkkod != undefined) {
                            let sql = `insert into rendelesek (cikkkod,mennyiseg,kezelokod,ar,brutto,asztalkod,szek,datum,kedvezmenyezheto, uzenet,sorrend) ` +
                                ` values( ${cikkkod}, ${mennyiseg}, "SWIPE", 0, 0, "${asztal}", 1, "", "I", ${mysql.escape(uzenet)}, ${sorrend}) `;

                            SqlExecute(sql);
                        } else {
                            console.log("Nincs GTSG azonosító megadva a selectables-nél!");
                        }
                    });
                }
            });
        } else {
            console.log("Nincs GTSG azonosító megadva az asztalnál!");
        }
    } catch (e) {
        console.error("newOrder error:" + (e as Error).message);
    }
}

export function eloZaras(asztal: string) {
    SqlExecute(`update asztalok set pda=1 where asztalszam="${asztal}"`);
}

export function dbvaltozas() {
    SqlExecute("ALTER TABLE cikk MODIFY rovidnev VARCHAR(80)");
}

export function idExists(cikkek: any[]) {
    return new Promise<Record<number, boolean>>((resolve, reject) => {
        let ret = "";
        let idext: Record<number, boolean> = {};
        cikkek.forEach(c => {
            ret += c.externalId + ",";
            idext[Number(c.externalId)] = false;
        });
        ret = ret.substring(0, ret.length - 1);

        pool.getConnection((err: any, connection: any) => {

            let sql = "select kod from cikk where kod in (" + ret + ") ";
            console.log(sql);

            connection.query(sql, (err: any, rows: any, fields: any) => {
                console.log(`Rows: ${rows.length}`);
                connection.release(); // return the connection to pool
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    rows.forEach((r: any[]) => {
                        let num: number = r[fields[0].name];
                        idext[num] = true;
                    });

                    resolve(idext);
                }
            });
        });



    });

}

export default router;
