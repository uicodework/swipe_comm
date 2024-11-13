import 'dotenv/config';
import { Client, TaskCommand, TaskEvent, Environment, OrderEventData, UniversalMenuItem, LangType } from 'swipelime-client-node';
import { ElementIdData, NativeTable, ServiceHandler, TablesEventData } from 'swipelime-client-node/dist/ServiceHandler';
var bodyParser = require('body-parser')
const mysql = require('mysql');

var express = require('express');

const app = express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

import api, { SqlExec, SqlExecute, SqlInsert, SqlOneValue, SqlOneValueDbl, dbvaltozas, eloZaras, idExists, newOrder, newOrderBulk } from "./routes/api";

process.argv.forEach((val, index) => {
    if (val === "--autostart")
        startService();
    //console.log(`${index}: ${val}`);
});

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

app.use('/api', api);

app.get('/', (req: any, res: any) => {
    //console.log(username);
    res.send("OK");
});

app.get('/verzio', (req: any, res: any) => {
    res.send("verzió:" + process.env['VERZIO']);
});

app.get('/start', (req: any, res: any) => {
    startService().then((ret) => res.json('status:' + ret));
    dbvaltozas();
});

app.get('/maptest', (req: any, res: any) => {
    maptest();
    res.send("verzió:" + process.env['VERZIO']);
});



app.get('/isready', (req: any, res: any) => {
    try {
        pserviceHandler.isReady().then((ret) => { res.json('status:' + ret) });
    }
    catch (error) {
        res.send("HIBA");
        console.error(error);
    }

});

let pserviceHandler: ServiceHandler;

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log('App listening on port: ' + port);
    console.log('App version: ' + process.env['VERZIO']);
});

export function getserviceHandler() {
    return pserviceHandler;
}

export function startService() {
    return new Promise((resolve, reject) => {

        const username = process.env['SWIPELIME_USERNAME'];
        const password = process.env['SWIPELIME_PASSWORD'];
        const tenantid = process.env['SWIPELIME_TENANT'] as string;
        const environment = process.env['SWIPELIME_ENVIRONMENT'] as Environment | undefined;

        if (username === undefined || password === undefined) throw new Error('SWIPELIME_USERNAME or SWIPELIME_PASSWORD environment variable not defined');

        const client = new Client({ username, password }, { environment });

        // Register a service handler for one of the available tenants
        (async () => {
            client.emitter.on('connected', async () => {
                console.log('swipelime client connected');
                console.log('client version: ' + client.clientVersion);
            });

            client.emitter.on('login', async (user) => {
                console.log('logged in user ID', user.id);
                const availableTenants = await client.getAvailableTenantIds();
                console.log('available tenants', availableTenants);
            });

            client.emitter.on('error', (e) => {
                console.error('error', e.message);
            });

            const serviceHandler = await client.addServiceHandler({ tenantId: tenantid });
            pserviceHandler = serviceHandler;

            serviceHandler.emitter.on('newTasks', (tasks) => {
                tasks.forEach(async (task) => {
                    if (task instanceof TaskEvent) {
                        console.log(task.data.eventType, JSON.stringify(task.data.eventData, null, 2));

                        if (task.data.eventType === "order-items-confirmed") {
                            newOrderBulk(task.data.eventData as OrderEventData);
                        }
                        else if (task.data.eventType === "payment-requested") {
                            if (task.data.eventData.tableData.externalId !== undefined)
                                eloZaras(task.data.eventData.tableData.externalId);
                        }
                        else if (task.data.eventType === "universal-menu-elements-added") {
                            const cikkek = task.data.eventData as UniversalMenuItem[];
                            cikkek.forEach(c => {
                                if (c.type === "item") {
                                    newCikk(c).then((ret) => {
                                        c.data.externalId = String(ret);
                                        console.log("upsertUniversalMenuItems");
                                        console.log(JSON.stringify(c.data, null, 2));
                                        serviceHandler.upsertUniversalMenuItems([c.data]).then((r) => { console.log(r) }).catch((e) => { console.error(e) });
                                        etlapTetelInsert(ret as number);
                                    });
                                }
                            });
                        }
                        else if (task.data.eventType === "universal-menu-elements-updated") {
                            const cikkek = task.data.eventData as UniversalMenuItem[];
                            cikkek.forEach(c => {
                                if (c.type === "item") {
                                    if (c.data.externalId != undefined) {
                                        updateCikk(c);
                                    }
                                }
                            });

                        }
                        else if (task.data.eventType === "tables-added") {
                            console.log("új asztal");
                            const asztalok = task.data.eventData as NativeTable[];
                            asztalok.forEach(asztal => {
                                ujasztal(asztal.id, asztal.label.hu, asztal.externalId);
                            });
                            //let asztal = task.data.eventData[0];
                        }
                        else if (task.data.eventType === "order-items-moved") {
                            console.log("áthelyez");
                            const asztalrol = task.data.eventData.fromTableData.externalId; // as NativeTable;
                            const asztalra = task.data.eventData.toTableData.externalId; // as NativeTable;
                            console.log(asztalrol + "->" + asztalra);
                            task.data.eventData.orderItems.forEach(r => {
                                SqlExec(`update rendelesek set asztalkod = ${mysql.escape(asztalra)} where asztalkod = ${mysql.escape(asztalrol)} and ifnull(statusz,"0") in ("0","1") and kulsoid=${mysql.escape(r.orderItemId)}`);
                            });
                            // console.log(JSON.stringify(task.data,null,2));

                        }
                        await task.confirm();

                    }
                    else if (task instanceof TaskCommand) {
                        console.log(task.data.commandType, JSON.stringify(task.data, null, 2));
                        if (task.data.commandType === "confirm-universal-menu-elements") {
                            const cikkek = task.data.commandData.elements as ElementIdData[];
                            idExists(cikkek).then((ret) => {
                                console.log(ret);
                                serviceHandler.confirmUniversalMenuElementsCommand(task, ret);
                            });
                            /*const orderPromises = orders.map(order => api.sendOrder(order));
                              Promise.all(orderPromisses).then(arrayOfResponses => {
                                  // do your stuff
                              })
                              */
                            /*   const ret2 = cikkek.map(c => ({c.externalId: isExistsElement(c.externalId)}));
                              
                              const ret = cikkek.map(c => {
                                      if (c.externalId != undefined) {
                                          isExistsElement(c.externalId);
                                      }
                              });
                              console.log(ret);
                              */
                        }

                        await serviceHandler.confirmTestCommand(task);
                    }
                });
            });
        })().then(() => {
            resolve("OK");
            console.log("elindult")
        });
    });

    function successCallback(result: any) {
        SqlOneValue('kod', 'cikkcsoportok', ' nev="SWIPLIME"').then((ret) => {

        }

        )
    }

    function isExistsElement(externalId: string) {
        return { externalId: true };
    }

    async function getCsoportkod(csopkod: string) {
        return new Promise((resolve, reject) => {
            if (csopkod.length == 0) {
                SqlExec("insert into cikkcsoportok (nev, focsoport, ikontipus)" +
                    "    SELECT * FROM (SELECT 'SWIPELIME',0,6) AS tmp" +
                    "    WHERE NOT EXISTS (" +
                    "        SELECT kod FROM cikkcsoportok WHERE nev = 'SWIPELIME'" +
                    "    ) LIMIT 1 ").then(() => {
                        SqlOneValue('kod', 'cikkcsoportok', " nev='SWIPELIME'")
                            .then((ret) => { resolve(ret) })
                    })
            }
            else {
                resolve(csopkod);
            }
        })
    }

    async function insertCikk(csopkod: string, c: UniversalMenuItem) {
        return new Promise((resolve, reject) => {
            let nyelv = process.env['SWIPELIME_NYELV'] || "hu";
            type LangKey = keyof LangType;

            let nev = c.data.label[nyelv as LangKey] || '';
            if (nev.length == 0)
                nev = c.data.label.hu || '';

            nev = nev.substring(0, 119);

            //let nev = c.data.label.hu?.substring(0, 119);

            let internalnev = c.data.internalName;

            let rovidnev = "";
            if (internalnev == undefined) {
                rovidnev = nev?.substring(0, 79) || '';
            }
            else {
                rovidnev = internalnev.substring(0, 79)
            }
            let brutto = c.data.price;
            let netto = brutto / 1.27;
            let afakulcs = 21.26;
            let kulsoazonosito = c.data.id;
            let me = "DB";
            let afakod = 6;

            (async () => {
                afakod = Number(await SqlOneValue("min(kod) as kod", "afakulcs", "ertek = 27"));
            })().then(() => {

                let sql = `insert into cikk (nev, rovidnev, csoportkod, brutto, nettoar, afakulcs, kulsoazonosito, me, afakod) 
                        values (${mysql.escape(nev)}, ${mysql.escape(rovidnev)}, ${csopkod}, ${brutto}, round( ${netto},2), ${afakulcs}, ${mysql.escape(kulsoazonosito)}, ${mysql.escape(me)}, ${afakod})`;

                SqlInsert(sql).then((ret) => {
                    //let val = JSON.parse(JSON.stringify(ret));
                    //let ujid = val[0].res;
                    console.log("új id: " + ret);
                    resolve(ret);
                });
            });
        })
    }

    async function newCikk(c: UniversalMenuItem) {
        return new Promise((resolve, reject) => {

            SqlOneValue("kod", "cikkcsoportok", "nev='SWIPELIME'")
                .then((ret) => getCsoportkod(String(ret))
                    .then((kod) => insertCikk(String(kod), c))
                    .then((cikkid) => { resolve(cikkid) })
                )
        })

    }

    function ujasztal(id: string, name: string | undefined, extid: string | undefined) {
        if ((name == undefined) && (extid == undefined)) {
            return;
        }

        //helyiség ellenőrzés
        SqlExecute("INSERT IGNORE INTO helyisegek (kod, nev) VALUES ('SWIPELIME', 'SWIPELIME')");

        if (extid == undefined) {
            SqlExecute("INSERT IGNORE INTO asztalok (asztalszam, helyisegkod, statusz, balx, baly, jobbx, jobby, torolt, alak) " +
                " VALUES ('" + name + "', 'SWIPELIME', 'zart', 0, 0, 20, 20, 'N', 1)");

            //visszaküldjük az azonosítót, hogy ki legyen töltve a külső azonosító
            let table: any;
            table = {
                id: id,
                externalId: name,
                label: { hu: name }
            };
            console.log(table);

            getserviceHandler().upsertTables([table]).then((ret) => {
                console.log("upsertTables");
                console.log(ret);

            });

        } else {
            SqlExecute("INSERT IGNORE INTO asztalok (asztalszam, helyisegkod, statusz, balx, baly, jobbx, jobby, torolt, alak) " +
                " VALUES ('" + extid + "', 'SWIPELIME', 'zart', 0, 0, 20, 20, 'N', 1)");

        }



    }

    function updateCikk(cikk: UniversalMenuItem) {

        let tiltott = "N";
        let aktiv = "I";
        if (!cikk.data.enabled) {
            tiltott = "I";
            aktiv = "N";
        }
        //  let internalnev = cikk.data.internalName;
        //let nev = cikk.data.label.hu?.substring(0, 119);
        let nyelv = process.env['SWIPELIME_NYELV'] || "hu";
        type LangKey = keyof LangType;

        let nev = cikk.data.label[nyelv as LangKey] || '';
        
        if (nev.length == 0)
            nev = cikk.data.label.hu || '';

        nev = nev.substring(0, 119);


        let internalnev = cikk.data.internalName;
        console.log(internalnev);
        let rovidnev = "";
        if (internalnev == undefined) {
            rovidnev = nev?.substring(0, 79) || '';
        }
        else {
            rovidnev = internalnev.substring(0, 79)
        }
        let sql = "update cikk set nev = " + mysql.escape(nev) +
            ", rovidnev= " + mysql.escape(rovidnev) +
            //   " , tiltott = " + mysql.escape(tiltott) + 
            " where kod = " + cikk.data.externalId;

        SqlExecute(sql);

        SqlOneValueDbl("afakulcs", "cikk", "kod = " + cikk.data.externalId).then((afakulcs) => {
            let brutto = cikk.data.price;
            let netto = (100.0 - afakulcs) / 100.0 * brutto;
            sql = `update cikk set brutto = ${brutto}, nettoar =round( ${netto},2) where kod = ${cikk.data.externalId}`;
            SqlExecute(sql);
            sql = `update etlaptetelek set brutto = ${brutto}, nettoar =round( ${netto},2), aktiv= ${mysql.escape(aktiv)}  where cikkkod = ${cikk.data.externalId}`;
            SqlExecute(sql);

        });

    }

    function etlapTetelInsert(cikkkod: number) {
        let sql = `INSERT INTO etlaptetelek (etlapkod, cikkkod, brutto, nettoar, aktiv) ` +
            ` SELECT e.kod, c.kod, c.brutto, c.nettoar, 'I' ` +
            ` FROM cikk c, etlap e ` +
            ` WHERE c.kod = ${cikkkod}` +
            ` AND c.brutto>0`;
        SqlExecute(sql);
    }

    function etlapTetelDelete(cikkkod: number) {
        SqlExecute(`delete from etlaptetelek WHERE cikkkod = ${cikkkod}`);
    }


}

function ttt(id: string) {
    let iid = id;
    return { [id]: true };
}

function maptest() {
    let cikkek = [
        {
            "id": "xzke9tCBxRrb9cvzC",
            "externalId": "908"
        },
        {
            "id": "xzke9Rrb9cvzC",
            "externalId": "909"
        }
    ];
    console.log(cikkek);
    const ret = cikkek.map(c => ttt(c.externalId));
    console.log(ret);
}


