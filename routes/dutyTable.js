// import express from "express";
// import { addDutyRate, getDutyRates, addCountry, addProduct, getAllProducts, getAllCountries } from "../controllers/dutyTableController.js";
// import { authenticate, authorizeRoles } from "../middlewares/auth.js";

// const router = express.Router();

// router.post("/", authenticate, authorizeRoles("Admin", "Manager", "Viewer"), addDutyRate);
// router.get("/", authenticate, getDutyRates);


// router.post('/product', authenticate, addProduct);
// router.post('/country', authenticate, addCountry);

// router.get('/products', getAllProducts);
// router.get('/countries', getAllCountries);

// export default router;

import express from "express";
import {
  addDutyRate,
  getDutyRates,
  addCountry,
  addProduct,
  getAllProducts,
  getAllCountries,
  // deleteCountry,
  // deleteProduct,
  deleteProductOrCountryWithDuties,
} from "../controllers/dutyTableController.js";
// import { authenticate, authorizeRoles } from "../middlewares/auth.js"; // <-- Not needed for testing

const router = express.Router();

// REMOVE authenticate/authorizeRoles for local testing:
router.post("/", addDutyRate);
router.get("/", getDutyRates);

router.post("/product", addProduct);
router.post("/country", addCountry);

router.get("/products", getAllProducts);
router.get("/countries", getAllCountries);
// router.delete('/countries/:id', deleteCountry);
// router.delete('/products/:id', deleteProduct);
router.delete('/deleteProductOrCountryWithDuties', deleteProductOrCountryWithDuties);

// router.get("/import-duty", getAllCountries);


export default router;
