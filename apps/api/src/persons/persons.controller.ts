import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth';
import { flexibleDateInput } from '../common/flexible-date';
import { ZodPipe } from '../common/zod';
import { AccessService, CAN } from '../families/access';
import { PersonsService } from './persons.service';

const nameSchema = z.object({
  type: z.enum(['birth', 'taboo', 'courtesy', 'pen', 'posthumous', 'other']).default('birth'),
  valueVi: z.string().trim().min(1).max(200),
  valueHanNom: z.string().trim().max(200).nullable().default(null),
  isPrimary: z.boolean().default(false),
});

const personFields = {
  gender: z.enum(['male', 'female', 'unknown']),
  livingStatus: z.enum(['alive', 'deceased', 'unknown']),
  generationRecorded: z.number().int().min(1).max(200).nullable(),
  siblingOrder: z.number().int().min(1).max(50).nullable(),
  siblingOrderNote: z.enum(['unknown', 'twin']).nullable(),
  isAnonymous: z.boolean(),
  birthDate: flexibleDateInput.nullable(),
  deathDate: flexibleDateInput.nullable(),
  biography: z.string().max(20000).nullable(),
};

const createPersonSchema = z.object({
  gender: personFields.gender.default('unknown'),
  livingStatus: personFields.livingStatus.default('unknown'),
  names: z.array(nameSchema).max(20).default([]),
  generationRecorded: personFields.generationRecorded.default(null),
  siblingOrder: personFields.siblingOrder.default(null),
  siblingOrderNote: personFields.siblingOrderNote.default(null),
  isAnonymous: personFields.isAnonymous.default(false),
  birthDate: personFields.birthDate.default(null),
  deathDate: personFields.deathDate.default(null),
  biography: personFields.biography.default(null),
});

const updatePersonSchema = z.object({ ...personFields, version: z.number().int().min(1) }).partial().required({ version: true });

const parentChildSchema = z.object({
  parentId: z.uuid(),
  childId: z.uuid(),
  type: z.enum(['biological', 'adoptive', 'heir_adoption', 'unknown']).default('biological'),
});

const unionSchema = z.object({
  partner1Id: z.uuid(),
  partner2Id: z.uuid(),
  unionOrder: z.number().int().min(1).max(20).nullable().default(null),
  unionLabel: z.string().trim().max(50).nullable().default(null),
  endReason: z.enum(['divorce', 'widowed']).nullable().default(null),
});

const familyId = ParseUUIDPipe;

@Controller('families/:familyId')
@UseGuards(AuthGuard)
export class PersonsController {
  constructor(
    private readonly access: AccessService,
    private readonly persons: PersonsService,
  ) {}

  @Get('persons')
  async list(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string, @Query('q') q?: string) {
    return this.persons.list(await this.access.context(fid, u.id), q);
  }

  @Post('persons')
  async create(
    @CurrentUser() u: AuthUser,
    @Param('familyId', familyId) fid: string,
    @Body(new ZodPipe(createPersonSchema)) body: z.infer<typeof createPersonSchema>,
  ) {
    return this.persons.create(await this.access.require(fid, u.id, CAN.editPersons), body);
  }

  @Get('persons/:personId')
  async get(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string, @Param('personId', ParseUUIDPipe) pid: string) {
    return this.persons.get(await this.access.context(fid, u.id), pid);
  }

  @Patch('persons/:personId')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('familyId', familyId) fid: string,
    @Param('personId', ParseUUIDPipe) pid: string,
    @Body(new ZodPipe(updatePersonSchema)) body: z.infer<typeof updatePersonSchema>,
  ) {
    return this.persons.update(await this.access.require(fid, u.id, CAN.editPersons), pid, body);
  }

  @Post('persons/:personId/verify-basis')
  async verifyBasis(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string, @Param('personId', ParseUUIDPipe) pid: string) {
    return this.persons.verifyBasis(await this.access.require(fid, u.id, CAN.verifyBasis), pid);
  }

  @Get('tree/:rootId')
  async tree(
    @CurrentUser() u: AuthUser,
    @Param('familyId', familyId) fid: string,
    @Param('rootId', ParseUUIDPipe) rootId: string,
    @Query('depth') depth?: string,
  ) {
    const d = Math.min(Math.max(Number(depth) || 12, 1), 40);
    return this.persons.tree(await this.access.context(fid, u.id), rootId, d);
  }

  @Get('anniversaries')
  async anniversaries(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string, @Query('days') days?: string) {
    const d = Math.min(Math.max(Number(days) || 60, 1), 400);
    return this.persons.anniversaries(await this.access.context(fid, u.id), d);
  }

  @Post('parent-child')
  async addParentChild(
    @CurrentUser() u: AuthUser,
    @Param('familyId', familyId) fid: string,
    @Body(new ZodPipe(parentChildSchema)) body: z.infer<typeof parentChildSchema>,
  ) {
    return this.persons.addParentChild(await this.access.require(fid, u.id, CAN.editPersons), body.parentId, body.childId, body.type);
  }

  @Delete('parent-child/:id')
  @HttpCode(204)
  async removeParentChild(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.persons.removeParentChild(await this.access.require(fid, u.id, CAN.editPersons), id);
  }

  @Post('unions')
  async addUnion(
    @CurrentUser() u: AuthUser,
    @Param('familyId', familyId) fid: string,
    @Body(new ZodPipe(unionSchema)) body: z.infer<typeof unionSchema>,
  ) {
    return this.persons.addUnion(await this.access.require(fid, u.id, CAN.editPersons), body);
  }

  @Delete('unions/:id')
  @HttpCode(204)
  async removeUnion(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.persons.removeUnion(await this.access.require(fid, u.id, CAN.editPersons), id);
  }

  @Get('history')
  async history(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string) {
    return this.persons.history(await this.access.require(fid, u.id, CAN.revert));
  }

  @Post('history/:changeSetId/revert')
  async revert(@CurrentUser() u: AuthUser, @Param('familyId', familyId) fid: string, @Param('changeSetId', ParseUUIDPipe) id: string) {
    return this.persons.revert(await this.access.require(fid, u.id, CAN.revert), id);
  }
}
