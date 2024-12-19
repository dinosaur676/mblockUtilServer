const {logger} = require('../framework/log.js');
const maria = require("mysql");
const dotenv = require('dotenv');

dotenv.config();

const mariaDB = maria.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: 5
})

const insertNetworkSQL = "insert into network_info(network, category, url, form, api_id) values(?, ?, ?, ?, ?)";
const insertWalletSQL = "insert into wallet_info(network, category, name, address) values(?, ?, ?, ?)";
const selectNetworkSQL = "select * from network_info";
const selectNetworkGroupBySQL = "select * from network_info group by network";
const selectWalletSQL = "select * from wallet_info";
const deleteNetworkSQL = "delete from network_info where network = ? and category = ?";
const deleteWalletSQL = "delete from wallet_info where id = ?";
const insertCoinPriceSQL = "insert into coin_price(network, api_id, price) values(?, ?, ?)"
const selectCoinPriceSQL = `
    SELECT network, api_id, price
    FROM (
             SELECT network, api_id, price,
                    ROW_NUMBER() OVER (PARTITION BY network ORDER BY created_on DESC) AS row_num
             FROM coin_price
         ) temp
    WHERE row_num = 1;
`

const selectAPISQL = `
    select ni.network, ni.url, ni.form, ni.api_id, wi.category, wi.address
    from network_info ni 
    join wallet_info wi on wi.network = ni.network and wi.category = ni.category 
`

async function deleteNetwork(network, category) {
    const connection = await getConnection();

    return await new Promise((resolve, reject) => {
        connection.query(deleteNetworkSQL, [network, category], (err, results) => {
            connection.release(); // 연결 해제

            if (err) {
                logger.error(err)
                return reject(err);
            }

            resolve(results);
        });
    });
}

async function deleteWallet(id) {
    const connection = await getConnection();

    return await new Promise((resolve, reject) => {
        connection.query(deleteWalletSQL, id, (err, results) => {
            connection.release(); // 연결 해제

            if (err) {
                logger.error(err)
                return reject(err);
            }

            resolve(results);
        });
    });
}

async function selectNetwork() {
    const connection = await getConnection();

    return await new Promise((resolve, reject) => {
        connection.query(selectNetworkSQL, [], (err, results) => {
            connection.release(); // 연결 해제

            if (err) {
                logger.error(err)
                return reject(err);
            }

            resolve(results);
        });
    });
}

async function selectNetworkGroupBy() {
    const connection = await getConnection();

    return await new Promise((resolve, reject) => {
        connection.query(selectNetworkGroupBySQL, [], (err, results) => {
            connection.release(); // 연결 해제

            if (err) {
                logger.error(err)
                return reject(err);
            }

            resolve(results);
        });
    });
}

async function selectAPI() {
    const connection = await getConnection();

    return await new Promise((resolve, reject) => {
        connection.query(selectAPISQL, [], (err, results) => {
            connection.release(); // 연결 해제

            if (err) {
                logger.error(err)
                return reject(err);
            }

            resolve(results);
        });
    });
}

async function selectWallet() {
    const connection = await getConnection();

    return await new Promise((resolve, reject) => {
        connection.query(selectWalletSQL, [], (err, results) => {
            connection.release(); // 연결 해제

            if (err) {
                logger.error(err)
                return reject(err);
            }

            resolve(results);
        });
    });
}


async function selectCoinPrice() {
    const connection = await getConnection();

    return await new Promise((resolve, reject) => {
        connection.query(selectCoinPriceSQL, [], (err, results) => {
            connection.release(); // 연결 해제

            if (err) {
                logger.error(err)
                return reject(err);
            }

            resolve(results);
        });
    });
}

async function insertCoinPrice (network, api_id, price) {
    const dto = [network, api_id, price]

    const conn = await getConnection();

    return await new Promise((resolve, reject) => {
        conn.query(insertCoinPriceSQL, dto, (err, results) => {
            conn.release();

            if (err) {
                logger.error(err);
                reject(err);
            }

            resolve(results)
        });
    })
}

async function insertNetwork (network, category, url, form, api_id) {
    const dto = [network, category, url, form, api_id]

    const conn = await getConnection();

    return await new Promise((resolve, reject) => {
        conn.query(insertNetworkSQL, dto, (err, results) => {
            conn.release();

            if (err) {
                logger.error(err);
                reject(err);
            }

            resolve(results)


        });
    })
}


async function insertWallet (network, category, name, address) {
    const dto = [network, category, name, address]

    const conn = await getConnection();

    return await new Promise((resolve, reject) => {
        conn.query(insertWalletSQL, dto, (err, results) => {
            conn.release();

            if (err) {
                logger.error(err);
                reject(err)
            }

            resolve({id: results.insertId})


        });
    });
}

const getConnection = () => {
    return new Promise((resolve, reject) => {
        mariaDB.getConnection((err, connection) => {
            if (err) {
                logger.error(err);
                return reject(err);
            }
            resolve(connection);
        });
    });
};

module.exports = {
    insertNetwork,
    insertWallet,
    selectNetwork,
    selectWallet,
    deleteNetwork,
    deleteWallet,
    selectCoinPrice,
    insertCoinPrice,
    selectNetworkGroupBy,
    selectAPI,
}