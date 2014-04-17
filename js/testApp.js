var dbName = "TestDB",
    storeName = "TestStore",
    dbVersion = 1,
    logLevel = 0,
    repetitions = 100;

// helpers

    function writeLog (level, text) {
        var entry = document.createElement("li");
        entry.setAttribute("id", level);
        entry.innerText = level +": " + text;
        document.getElementById('results').appendChild(entry);
    }

    function log (text) {
        if (logLevel <= 0){
            writeLog("log", text);
        }
    }

    function info (text) {
        if (logLevel <= 1){
            writeLog("info", text);
        }
    }

    function warn (text) {
        if (logLevel <= 2){
            writeLog("warn", text);
        }
    }

    function error (text) {
        if (logLevel <= 3){
            writeLog("error", text);
        }
    }

    function random (max) { return Math.floor(Math.random() * (max - 1)); }

    function randomData (max) { return {id: random(max), data: new Date().getTime()}; }

    function randomDataArray (len) {
        var result = [];
        for (var i = 0; i < len; i++) {
            result.push(randomData(1000));
        }
        return result;
    }

    function setLogLevel () {
        logLevel = document.getElementById("loglevel").selectedIndex;
    }

    function getRepetitions () {
        repetitions = document.getElementById("repetitions").value;
        return repetitions;
    }
// helpers

function writeData(data, db, label) {
    var dataToWrite = data;
    if (dataToWrite.constructor == "Object") { dataToWrite = [dataToWrite]; }
    info("Start transaction " + label);
    var tran = db.transaction(storeName, "readwrite");
    tran.onerror = function () { error(label + ": error during transaction"); };
    tran.oncomplete = function () { info(label + ": Transaction completed"); };
    tran.onabort = function () { error(label + ": Transaction aborted"); };
    var store = tran.objectStore(storeName);
    dataToWrite.forEach(function (dataElem) {
        var putReq = store.put(dataElem);
        log(label + ": Added new row to store: " + dataElem.id + ", " + dataElem.data);
        putReq.onerror = function () { error("error while adding data to store"); };
    });
}

function readData(lower, upper, db, label) {
    info("Start transaction " + label);
    var tran = db.transaction(storeName, "readonly");
    tran.oncomplete = function () { info(label + ": Transaction completed"); };
    tran.onabort = function () { error(label + ": Transaction aborted"); };
    tran.onerror = function () { error(label + ": error during transaction"); };
    var store = tran.objectStore(storeName);
    var range = IDBKeyRange.bound(lower, upper);
    var curReq = store.openCursor(range);
    curReq.onsuccess = function (req) {
        var cursor = req.target.result;
        if (cursor) {
            item = cursor.value;
            log(label + ": Get new row from store: " + item.id + ", " + item.data);
            cursor["continue"]();
        }
    };
    curReq.onblocked = function (req) { warn(label + ': Read operation is blocked'); };
    curReq.onerror = function (req) { error(label + ': error while reading data'); };
}

function simpleTest() {
    cleanTest();
    var openReq = indexedDB.open(dbName, dbVersion);
    openReq.onupgradeneeded = function (req) {
        var db = req.target.result;
        db.createObjectStore(storeName, {autoIncrement: true});
        log("Created new store: " + storeName);
    };
    openReq.onsuccess = function (req) {
        log("Successfully opened database");
        var db = req.target.result;
        var testData1 = randomDataArray(getRepetitions());
        var testData2 = randomDataArray(getRepetitions());
        setTimeout(function () { readData(0, Infinity, db, "readTran"); }, 10);
        setTimeout(function () { writeData(testData2, db, "Tran2"); }, 5);
        writeData(testData1, db, "Tran1");
    };
    openReq.onblocked = function (req) {
        warn('Database is blocked');
    };
    openReq.onerror = function (req) {
        error('error while opening database');
    };
}

function complexTest () {
    cleanTest();
    var openReq = indexedDB.open(dbName, dbVersion);
    openReq.onupgradeneeded = function (req) {
        var db = req.target.result;
        db.createObjectStore(storeName, {autoIncrement: true});
        log("Created new store: " + storeName);
    };
    openReq.onsuccess = function (req) {
        log("Successfully opened database");
        var db = req.target.result;
        var testCount = getRepetitions();
        var tranCount = 0;
        var writer1 = setInterval(function () {
            writeData(randomDataArray(1), db, "writeTran1");
            if (tranCount++ > testCount) {
                clearInterval(writer1);
                clearInterval(reader);
                log("---------------------------------------End writer 1---------------------------");
            }
        }, 100);
        var writer2 = setInterval(function () {
            writeData(randomDataArray(1), db, "writeTran2");
            if (tranCount++ > testCount) {
                clearInterval(writer2);
                clearInterval(reader);
                log("---------------------------------------End writer 2---------------------------");
            }
        }, 120);
        var reader = setInterval(function () { readData(0, Infinity, db, "readTran"); }, 150);
    };
    openReq.onblocked = function (req) {
        warn('Database is blocked');
    };
    openReq.onerror = function (req) {
        error('Error while opening database');
    };
}

function readWriteTest() {
    cleanTest();
    var openReq = indexedDB.open(dbName, dbVersion);
    openReq.onupgradeneeded = function (req) {
        var db = req.target.result;
        db.createObjectStore(storeName, {autoIncrement: true});
        log("Created new store: " + storeName);
    };
    openReq.onsuccess = function (req) {
        log("Successfully opened database");
        var db = req.target.result;
        var data = [],
            testCount = getRepetitions(),
            tranCount = 0;
        var writer1 = setInterval(function () {
            var label = "writer1",
                dataToPush = randomData(1000);
            var tran = db.transaction(storeName, "readwrite");
            tran.onerror = function () { error(label + ": error during transaction"); };
            tran.oncomplete = function () { info(label + ": Transaction completed"); };
            tran.onabort = function () { error(label + ": Transaction aborted"); };
            var store = tran.objectStore(storeName);
            var putReq = store.put(dataToPush);
            putReq.onsuccess = function () {
                data.push(dataToPush);
                log("Successfully added data: " + JSON.stringify(dataToPush));
            };
            putReq.onerror = function () { error(label + ": Error while adding data to store"); };
            if (tranCount++ > testCount) {
                clearInterval(writer1);
                writer1 = false;
                log("----------------------Stop writer1------------------------");
            }
        }, 100);
        var writer2 = setInterval(function () {
            var label = "writer2",
                dataToPush = randomData(1000);
            var tran = db.transaction(storeName, "readwrite");
            tran.onerror = function () { error(label + ": error during transaction"); };
            tran.oncomplete = function () { info(label + ": Transaction completed"); };
            tran.onabort = function () { error(label + ": Transaction aborted"); };
            var store = tran.objectStore(storeName);
            var putReq = store.put(dataToPush);
            putReq.onsuccess = function () {
                data.push(dataToPush);
                log("Successfully added data: " + JSON.stringify(dataToPush));
            };
            putReq.onerror = function () { error(label + ": Error while adding data to store"); };
            if (tranCount++ > testCount) {
                clearInterval(writer2);
                writer2 = false;
                log("----------------------Stop writer2------------------------");
            }
        }, 120);
        var reader = setInterval(function () {
            var label = "reader";
            var tran = db.transaction(storeName, "readonly");
            tran.oncomplete = function () { info(label + ": Transaction completed"); };
            tran.onabort = function () { error(label + ": Transaction aborted"); };
            tran.onerror = function () { error(label + ": error during transaction"); };
            var store = tran.objectStore(storeName);
            var dataIndex = random(data.length);
            var range = IDBKeyRange.only(dataIndex);
            var curReq = store.openCursor(range);
            curReq.onsuccess = function (req) {
                var cursor = req.target.result;
                if (cursor) {
                    item = cursor.value;
                    log(label + ": Get new row from store: " + item.id + ", " + item.data);
                    if (data[dataIndex].id == item.id && data[dataIndex].data == item.data) {
                        log("Data verified");
                    } else {
                        error("Data is not corresponding!: " +
                            JSON.stringify(data[dataIndex]) +
                            " via " + JSON.stringify(item));
                    }
                    cursor["continue"]();
                }
            };
            curReq.onblocked = function (req) {
                warn(label + ': Read operation is blocked');
            };
            curReq.onerror = function (req) {
                error(label + ': error while reading data');
            };
            if (!writer1 && !writer2) {
                clearInterval(reader);
                log("----------------------Stop reader------------------------");
            }
        }, 150);
    };
    openReq.onblocked = function (req) {
        warn('Database is blocked');
    };
    openReq.onerror = function (req) {
        error('Error while opening database');
    };
}
// window.shimIndexedDB.__useShim();
function openDatabaseTest() {
    // // clean up
    cleanTest();

    for(var idx = 0; idx < 100; idx++) {
        cleanDB('testDB-' + idx);
    }
    cleanDB('testDB');

    var testCount = getRepetitions();

    function openDatabaseAndWrite(dbToOpen) {
        dbToOpen = dbToOpen || 'testDatabase';
        var db;
        var openReq = indexedDB.open(dbToOpen);
        openReq.onblocked = function (req) {
            warn('Database is blocked: ' + dbName);
        };
        openReq.onerror = function (req) {
            error('Error while opening database ' + dbName);
        };
        openReq.onupgradeneeded = function(event) {
            var db = event.target.result;
            // TODO - potential issue
            db.createObjectStore(storeName, {autoIncrement: true});

        };
        openReq.onsuccess = function(event) {
          db = openReq.result;
          log(dbToOpen + ' has been successfully created/opened');
          var dataToPush = randomData(1000);
          var label = dbToOpen;
          var tran = db.transaction(storeName, "readwrite");
            tran.onerror = function () { error(label + ": error during transaction"); };
            tran.oncomplete = function () { info(label + ": Transaction completed"); 
                try{
                    log('cleanDB');
                    cleanDB(dbToOpen);
                } catch(ex) {
                    log('Error: ' + ex);
                }
            };

            tran.onabort = function () { error(label + ": Transaction aborted"); };
            var store = tran.objectStore(storeName);
            var putReq = store.put(dataToPush);
            putReq.onsuccess = function () {
                log("Successfully added data: " + JSON.stringify(dataToPush));
            };
            putReq.onerror = function () { error(label + ": Error while adding data to store"); };
        };
    };

    log("Test unique DB creation + write data");
    // different databases
    for(var idx = 0; idx < testCount; idx++) {
        var uniquedbName = 'testDB-' + idx;
        //console.log(uniquedbName);
        //setTimeout(function(){
            openDatabaseAndWrite(uniquedbName);
        //},0);
    }

    log("Test creation of the same DB + write data");
    // sane databases
    // for(var idx = 0; idx < testCount; idx++) {
    //     setTimeout(function(){
    //         openDatabaseAndWrite('testDB');
    //     },0);
    // }
}

function cleanDB (dbToClean, onCompleted) {
    dbToClean = dbToClean||dbName;
    var delReq = indexedDB.deleteDatabase(dbToClean||dbName);
    delReq.onsuccess = function (req) {
        onCompleted && onCompleted();
    };
    delReq.onblocked = function (req) {
        log(dbToClean + ": Database is blocked");
    };
    delReq.onerror = function (req) {
        log(dbToClean + ": error when deleting database");
    };
}

function cleanTest () {
    var res = document.getElementById('results');
    while (res.firstChild) {
        res.removeChild(res.firstChild);
    }
    cleanDB(dbName)
}