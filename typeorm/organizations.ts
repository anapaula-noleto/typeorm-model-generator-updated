import { In, Repository } from "typeorm";
import { TypeORMRepository } from "./typeORMRepository.js";
import { OrganizationRepository } from "models/.js";

export class TypeORMOrganizationRepository
  extends TypeORMRepository<Organization>
  implements OrganizationRepository
{
  constructor(repository: Repository<Organization>) {
    super(repository);
  }
}
