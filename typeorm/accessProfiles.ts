import { In, Repository } from "typeorm";
import { TypeORMRepository } from "./typeORMRepository.js";
import { AccessProfileRepository } from "models/.js";

export class TypeORMAccessProfileRepository
  extends TypeORMRepository<AccessProfile>
  implements AccessProfileRepository
{
  constructor(repository: Repository<AccessProfile>) {
    super(repository);
  }
}
