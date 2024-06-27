import { In, Repository } from "typeorm";
import { TypeORMRepository } from "./typeORMRepository.js";
import { UserRepository } from "models/.js";

export class TypeORMUserRepository
  extends TypeORMRepository<User>
  implements UserRepository
{
  constructor(repository: Repository<User>) {
    super(repository);
  }
}
