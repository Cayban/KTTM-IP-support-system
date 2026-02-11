import bcrypt from "bcryptjs";

const run = async () => {
  const hashed = await bcrypt.hash("changeme2", 10);
  console.log("Hashed password:", hashed);
};

run();
