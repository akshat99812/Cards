import express, { Request, Response, Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

const app = express();
app.use(express.json());

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const JWT_SECRET = process.env.JWT_SECRET || "akshat";

console.log("server hit 3000/user");

//User ke signup karne ke liye Route
const signupRoute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = signUpSchema.parse(req.body);
    const existingUser = await prisma.player.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.player.create({
      data: { email, password: hashedPassword },
    });

    const token = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(201).json({ message: "User created successfully", token });

    return;
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: err.errors });
      //console.log("validation error", err);
    } else {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
};

//Route for user to signin
const signinRoute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = signInSchema.parse(req.body);
    const user = await prisma.player.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ message: "Sign-in successful", token });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
};

router.post("/signup", signupRoute);
router.post("/signin", signinRoute);

export default router;
