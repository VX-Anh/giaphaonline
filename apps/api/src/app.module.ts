import { DynamicModule, Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, AuthGuard } from './auth/auth';
import { DB, Db } from './db/db';
import { AccessService } from './families/access';
import { FamiliesController } from './families/families.controller';
import { PersonsController } from './persons/persons.controller';
import { PersonsService } from './persons/persons.service';
import { PlacesController, PlacesService } from './places/places';

@Global()
@Module({})
export class AppModule {
  static forRoot(db: Db, jwtSecret: string): DynamicModule {
    return {
      module: AppModule,
      imports: [JwtModule.register({ secret: jwtSecret, signOptions: { expiresIn: '12h' } })],
      controllers: [AuthController, FamiliesController, PersonsController, PlacesController],
      providers: [{ provide: DB, useValue: db }, AuthGuard, AccessService, PersonsService, PlacesService],
    };
  }
}
