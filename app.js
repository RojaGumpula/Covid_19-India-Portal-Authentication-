const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3001/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(-1);
  }
};

initializeDBAndServer();

const convertStateDBObjToResponseObj = (DbObject) => {
  return {
    stateId: DbObject.state_id,
    stateName: DbObject.state_name,
    population: DbObject.population,
  };
};

const convertDistrictDBObjToResponseObj = (DbObject) => {
  return {
    districtId: DbObject.district_id,
    districtName: DbObject.district_name,
    stateId: DbObject.state_id,
    cases: DbObject.cases,
    cured: DbObject.cured,
    active: DbObject.active,
    deaths: DbObject.deaths,
  };
};

//user Token authentication using middleware function//

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1 user LOGIN check valid user or not//

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API2 get list of all states//
app.get("/states/", authenticateToken, async (request, response) => {
  const getListOfStates = `SELECT * FROM state;`;
  const statesList = await db.all(getListOfStates);
  response.send(
    statesList.map((eachState) => convertStateDBObjToResponseObj(eachState))
  );
});
//converting each DB OBJ to response  object//

//API3 return a state based on state ID//

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateQuery = `SELECT * FROM state WHERE 
  state_id=${stateId};`;

  const stateDetails = await db.get(getStateQuery);
  response.send(convertStateDBObjToResponseObj(stateDetails));
});

//API4  create distric details in destric table//

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  //const districtExist = `select * from district where district_name='${districtName}'`;
  //const dbDistrict = await db.get(districtExist); NO NEED TO CHECK IT is already exit or not//
  const createDistrict = `INSERT INTO district (district_name,state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  await db.run(createDistrict);
  response.send("District Successfully Added");
});

//API5 GET A district details//

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district 
    WHERE district_id=${districtId};`;
    const districtDetails = await db.get(getDistrictQuery);
    response.send(convertDistrictDBObjToResponseObj(districtDetails));
  }
);
//converting DB obj to response obj//

//API6 delete DISTRICT //

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDeleteDistrictQuery = `DELETE FROM district WHERE 
    district_id=${districtId};`;
    await db.run(getDeleteDistrictQuery);
    response.send("District Removed");
  }
);

//API7 update district details//

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const getUpdateDistrictQuery = `Update district 

    SET 
    district_name='${districtName}',
    state_id= ${stateId},
    cases= ${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    
    WHERE 
    district_id = ${districtId};`;
    await db.run(getUpdateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API8 //
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalDistrictsUpdates = `SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths FROM district 
    WHERE state_id=${stateId} 
    `;
    const result = await db.get(getTotalDistrictsUpdates);
    response.send(result);
  }
);
module.exports = app;
