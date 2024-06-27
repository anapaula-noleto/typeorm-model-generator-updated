import { User } from "models/users.js";
import { Repository } from "./repository.js";

export interface UserRepository extends Repository<User> {}
