import 'dotenv/config';
import { Client, TaskCommand, TaskEvent, Environment, OrderEventData, UniversalMenuItem } from 'swipelime-client-node';
import { NativeTable, ServiceHandler, TablesEventData } from 'swipelime-client-node/dist/ServiceHandler';
var bodyParser = require('body-parser')
const mysql = require('mysql');

var express = require('express');

const app = express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

import api, { SqlExec, SqlExecute, SqlInsert, SqlOneValue, SqlOneValueDbl, eloZaras, newOrder } from "./routes/api";

process.argv.forEach((val, index) => {
    if (val === "--autostart")
        startService();
    //console.log(`${index}: ${val}`);
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
                console.log('client version: '+ client.clientVersion);
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
                            newOrder(task.data.eventData as OrderEventData);
                        }
                        else if (task.data.eventType === "payment-requested") {
                            if (task.data.eventData.tableData.externalId !== undefined)
                                eloZaras(task.data.eventData.tableData.externalId);
                        }
                        else if (task.data.eventType === "universal-menu-elements-added") {
                            const cikkek = task.data.eventData as UniversalMenuItem[];
                            cikkek.forEach(c => {
                                newCikk(c).then((ret) => {
                                    c.data.externalId = String(ret);
                                    console.log("upsertUniversalMenuItems");
                                    console.log(JSON.stringify(c.data, null, 2));
                                    serviceHandler.upsertUniversalMenuItems([c.data]).then((r) => { console.log(r) }).catch((e) => { console.error(e) });
                                    etlapTetelInsert(ret as number);
                                });

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
                            asztalok.forEach( asztal => {
                                ujasztal(asztal.id, asztal.label.hu, asztal.externalId);
                            });
                            //let asztal = task.data.eventData[0];
                        }
                        await task.confirm();

                    }
                    else if (task instanceof TaskCommand) {
                        console.log(task.data.commandType, JSON.stringify(task.data, null, 2));

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

    async function getCsoportkod(csopkod: string) {
        return new Promise((resolve, reject) => {
            if (csopkod.length == 0) {
                SqlExec("insert into cikkcsoportok (nev, focsoport, ikontipus)"+
                        "    SELECT * FROM (SELECT 'SWIPELIME',0,6) AS tmp"+
                        "    WHERE NOT EXISTS ("+
                        "        SELECT kod FROM cikkcsoportok WHERE nev = 'SWIPELIME'"+
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
            let nev = c.data.label.hu?.substring(0,119);
            let rovidnev = nev?.substring(0,24);
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

    function updateCikk(cikk: UniversalMenuItem){
        
        let tiltott = "N";
        if (!cikk.data.enabled){
            tiltott = "I";
        }

        let sql = "update cikk set nev = " + mysql.escape(cikk.data.label.hu) +
                  " , tiltott = " + mysql.escape(tiltott) + 
                  " where kod = " + cikk.data.externalId;

        SqlExecute( sql );
        
        SqlOneValueDbl("afakulcs", "cikk", "kod = " + cikk.data.externalId).then( (afakulcs) => {
            let brutto = cikk.data.price;
            let netto = (100.0-afakulcs)/100.0 * brutto;
            sql = `update cikk set brutto = ${brutto}, nettoar =round( ${netto},2) where kod = ${cikk.data.externalId}`;
            SqlExecute(sql);
            sql = `update etlaptetelek set brutto = ${brutto}, nettoar =round( ${netto},2) where cikkkod = ${cikk.data.externalId}`;
            SqlExecute(sql);

        });

    }

    function etlapTetelInsert(cikkkod: number){
        let sql = `INSERT INTO etlaptetelek (etlapkod, cikkkod, brutto, nettoar, aktiv) ` +
        ` SELECT e.kod, c.kod, c.brutto, c.nettoar, 'I' ` +
        ` FROM cikk c, etlap e ` +
        ` WHERE c.kod = ${cikkkod}`; 
        SqlExecute(sql);
    }

    function etlapTetelDelete(cikkkod: number){
        SqlExecute(`delete from etlaptetelek WHERE cikkkod = ${cikkkod}`);
    }

}