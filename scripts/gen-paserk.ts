import { generateKeys } from "paseto-ts/v4";
const { secretKey, publicKey } = generateKeys("public");

console.log("Secret Key:", secretKey);
console.log("Public Key:", publicKey);
