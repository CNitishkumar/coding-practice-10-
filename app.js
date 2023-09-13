const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initilizeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, (request, response) => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
  }
};
initilizeDbAndServer();

// login api

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  let hashedPassword = await bcrypt.hash(request.body.password, 10);
  const getUserStatusSqlQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserStatusSqlQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
    console.log("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password);
    if (isPasswordCorrect === true) {
      response.status(200);
      const payload = {
        username: username,
      };

      const jwtToken = jwt.sign(payload, "MST");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
      console.log("Invalid password");
    }
  }
  ///end
});

// ATHENTICATION

const athenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MST", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        console.log(payload.username);
        next();
      }
    });
  }
};

const statesDbResponseToCamelCase = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: `${dbObject.state_name}`,
    population: dbObject.population,
  };
};

//API 2 GET ALL STATES

app.get("/states/", athenticateToken, async (request, response) => {
  const getStatesSqlQuery = `SELECT * FROM state;`;
  const dbResponse = await db.all(getStatesSqlQuery);
  const statesArray = dbResponse.map((each) =>
    statesDbResponseToCamelCase(each)
  );
  response.send(statesArray);
  console.log(statesArray);
});

// //API 3 GET sate With State Id

app.get("/states/:stateId/", athenticateToken, async (request, response) => {
  const stateId = request.params.stateId;
  const getStatesSqlQuery = `SELECT *
  FROM
  state
  WHERE
  state_id = ${stateId};`;
  const dbResponse = await db.get(getStatesSqlQuery);
  const stateObject = statesDbResponseToCamelCase(dbResponse);
  response.send(stateObject);
  console.log(stateObject);
});

// API 4 ADD District in DB

app.post("/districts/", athenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const addDistrictSqlQuery = `INSERT INTO district ( district_name, state_id,cases,cured,active,deaths)
  VALUES
  ('${districtName}',
   ${stateId},
   ${cases},
    ${cured},
     ${active},
      ${deaths});`;

  const dbResponse = db.run(addDistrictSqlQuery);
  response.send("District Successfully Added");
});

//API 5 GET a district with District district_id

const districtSnakeToCamelCase = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: `${dbObject.district_name}`,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  athenticateToken,
  async (request, response) => {
    const districtId = request.params.districtId;
    const getDistrictSqlQuery = `SELECT *
  FROM
  district
  WHERE
  district_id = ${districtId};`;
    const dbResponse = await db.get(getDistrictSqlQuery);
    const districtObject = districtSnakeToCamelCase(dbResponse);
    response.send(districtObject);
  }
);

//API 6

module.exports = app;

app.delete(
  "/districts/:districtId/",
  athenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteSqlQuery = `DELETE
    FROM
    district
    WHERE
    district_id =  ${districtId};`;

    const dbResponse = await db.run(deleteSqlQuery);
    response.send("District Removed");
  }
);

// API PUT 7

app.put(
  "/districts/:districtId/",
  athenticateToken,
  async (request, response) => {
    const districtId = request.params.districtId;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictSqlQuery = `UPDATE district
  SET
  district_name	 = '${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  WHERE
  district_id =${districtId};`;

    const dbResponse = await db.run(updateDistrictSqlQuery);
    response.send("District Details Updated");
  }
);

// API 8 GET state Stats

app.get(
  "/states/:stateId/stats/",
  athenticateToken,
  async (request, response) => {
    const stateId = request.params.stateId;
    const getStatsSqlQuery = `SELECT
  SUM(cases) AS totalCases,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) AS totalDeaths
  FROM
  district
  WHERE
  state_id = ${stateId};`;

    const stateStats = await db.get(getStatsSqlQuery);
    response.send(stateStats);
    console.log(stateStats);
  }
);

module.exports = app;
