import { In, Repository } from "typeorm";
import { TypeORMRepository } from "./typeORMRepository.js";
import { RouteRepository } from "models/.js";

export class TypeORMRouteRepository
  extends TypeORMRepository<Route>
  implements RouteRepository
{
  constructor(repository: Repository<Route>) {
    super(repository);
  }
}
