const fs = require('fs')
const axios = require('axios')
var express = require('express');
const {config} = require("dotenv");
const {
    insertNetwork, insertWallet, selectNetwork, selectWallet, deleteWallet, deleteNetwork, selectCoinPrice,
    selectNetworkGroupBy, insertCoinPrice, selectAPI
} = require("../db/database");
const {error} = require("winston");
const schedule = require('node-schedule');
const {logger} = require("../framework/log");
var router = express.Router();

require('dotenv').config();

router.delete("/wallet", async (req, res, next) => {
    const param = req.query

    await deleteWallet(param.id)
        .then(value => {
            res.status(200).send("Success")
        })
        .catch(reason => {
            res.status(500).send("Falied");
        })
})

router.delete("/network", async (req, res, next) => {
    const param = req.query

    await deleteNetwork(param.network, param.category)
        .then(value => {
            res.status(200).send("Success")
        })
        .catch(reason => {
            res.status(500).send("Falied");
        })
})

router.get("/price", async (req, res, next) => {
    const result = await getGeckoData();

    res.status(200).send(result);
})

router.get("/wallet", async (req, res, next) => {
    const result = await selectWallet()

    if (result == null) {
        res.status(500).send("failed")
        return;
    }

    res.status(200).send(result);
})

router.get("/network", async (req, res, next) => {
    const result = await selectNetwork()

    if (result == null) {
        res.status(500).send("failed")
        return;
    }

    res.status(200).send(result);
})


router.put("/network", async (req, res, next) => {
    const params = req.body;
    console.log(req.body);
    await insertNetwork(params.network, params.category, params.url, params.form, params.api_id)
        .then(value => {
            res.status(200).send("success");
            console.log("11")
        })
        .catch(error => {
            res.status(500).send("failed")
            console.log("22")
        })


})

router.put("/wallet", async (req, res, next) => {
    const params = req.body;
    console.log(req.body);
    await insertWallet(params.network, params.category, params.name, params.address)
        .then(value => {
            res.status(200).send(value);
        })
        .catch(reason => {
            res.status(500).send("Failed")
        })

})

router.get('/balance', async (req, res, next) => {
    const rawData = fs.readFileSync('./API_Key.json', 'utf8');
    const apiKeyJson = JSON.parse(rawData);
    const results = await selectAPI()

    const responseList = [];

    for(const row of results) {
        const jsonForm = JSON.parse(row.form);
        let data = row.form
        data = data.replace("%address", row.address);
        if (jsonForm.apiKey != null) {
            data = data.replace("%apiKey", apiKeyJson[jsonForm.apiKey])
        }

        const jsonResult = JSON.parse(data);

        const params = jsonResult.params;
        const headers = jsonResult.headers;
        const apiType = jsonResult.apiType;
        jsonResult["url"] = row.url.replace("%address", row.address);

        if (apiType === 1) {
            responseList.push(respPromise(row.network, axios.post(jsonResult.url, params, {headers: headers}), jsonResult))
        } else if (apiType === 0) {
            responseList.push(respPromise(row.network, axios.get(jsonResult.url, {headers: headers, params: params}), jsonResult))
        }
    }

    let isSuccess = true;
    const output = {}
    const responses = await Promise.all(responseList);

    responses.forEach((item) => {
        let balance = 0.0;
        try {
            let result = item.resp.data;

            result = result.results != null ? result.results : result;
            result = result.data != null ? result.data : result;

            const patterns = item.formDict.response.split(",");
            balance = analysisResponse(result, patterns, 0, item.formDict);
        }
        catch (e) {
            logger.error(e);
            isSuccess = false;
        }

        if(output[item.network] == null) {
            output[item.network] = 0.0;
        }

        output[item.network] += balance;
    })

    if(isSuccess) {
        res.status(200).send(output);
        return;
    }

    res.status(500).send("Failed");
});

const getGeckoData = async () => {
    let networkList = await selectNetworkGroupBy()
    const coinList = await selectCoinPrice()
    const outputDict = {};

    const networkDict = networkList.reduce((acc, item) => {
        acc[item.api_id] = {
            network: item.network,
            api_id: item.api_id,
        };
        return acc;
    }, {})

    const coinDict = coinList.reduce((acc, item) => {
        acc[item.api_id] = {
            network: item.network,
            api_id: item.api_id,
            price: item.price
        };
        return acc;
    }, {})


    const getList = []

    const GECKO_URL = process.env.GECKO_URL;
    const GECKO_API_KEY = process.env.GECKO_API_KEY;

    const headers = {
        "x-cg-api-key": GECKO_API_KEY,
        "Content-Type": "application/json"
    }

    for(let api_id of Object.keys(networkDict)) {
        if(coinDict[api_id] == null) {
            getList.push(axios.get(GECKO_URL + api_id, {headers: headers}))
            continue;
        }

        outputDict[networkDict[api_id].network] = coinDict[api_id].price;
    }


    const responses = await Promise.all(getList);

    responses.forEach((res) => {
        const data = res.data;

        const api_id = data.id
        const price = data.market_data.current_price.krw
        const network = networkDict[api_id].network

        insertCoinPrice(network, api_id, price);
        outputDict[network] = price;
    })

    return outputDict;
}

const newCoinData = async () => {
    let networkList = await selectNetworkGroupBy()

    const networkDict = networkList.reduce((acc, item) => {
        acc[item.api_id] = {
            network: item.network,
            api_id: item.api_id,
        };
        return acc;
    }, {})

    const getList = []

    const GECKO_URL = process.env.GECKO_URL;
    const GECKO_API_KEY = process.env.GECKO_API_KEY;

    const headers = {
        "x-cg-api-key": GECKO_API_KEY,
        "Content-Type": "application/json"
    }

    for(let api_id of Object.keys(networkDict)) {
        getList.push(axios.get(GECKO_URL + api_id, {headers: headers}))
    }


    const responses = await Promise.all(getList);

    responses.forEach((res) => {
        const data = res.data;

        const api_id = data.id
        const price = data.market_data.current_price.krw
        const network = networkDict[api_id].network

        insertCoinPrice(network, api_id, price);
    })
}

const respPromise = async (network, promise, formDict) => {
    const response = await promise

    return {network: network, resp: response, formDict: formDict}
}

const analysisResponse = (value, patterns, index, networkForm) => {
    let balance = 0.0;

    if(patterns[index + 1] == null) {
        return value[patterns[index]] / networkForm.div;
    }

    if(patterns[index] === "[]") {
        for(let val of value) {
            balance += analysisResponse(val, patterns, index + 1, networkForm)
        }
    }
    else {
        balance += analysisResponse(value[patterns[index]], patterns, index + 1, networkForm);
    }

    return balance;
}


schedule.scheduleJob(('0 0 8 * * *'), () => {
    newCoinData();
})


module.exports = router;
