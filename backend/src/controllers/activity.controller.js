import * as activityService from '../services/activity.service.js';
import {
  parseActivityInput,
  parseContactInput,
  parseId,
  parseListFilters,
  parseLogInput,
  parseStatusInput,
} from '../validators/activity.validator.js';

export async function list(req, res) {
  res.json(await activityService.listActivities(parseListFilters(req.query)));
}

export async function categories(req, res) {
  res.json(await activityService.listCategories());
}

export async function show(req, res) {
  res.json(await activityService.getActivity(parseId(req.params.id)));
}

export async function create(req, res) {
  const activity = await activityService.createActivity(parseActivityInput(req.body));
  res.status(201).json(activity);
}

export async function createContact(req, res) {
  const activity = await activityService.createContact(parseContactInput(req.body));
  res.status(201).json(activity);
}

export async function update(req, res) {
  const id = parseId(req.params.id);
  res.json(await activityService.updateActivity(id, parseActivityInput(req.body, { partial: true })));
}

export async function remove(req, res) {
  await activityService.deleteActivity(parseId(req.params.id));
  res.status(204).end();
}

export async function changeStatus(req, res) {
  const { status, note, date } = parseStatusInput(req.body);
  res.json(await activityService.changeStatus(parseId(req.params.id), status, { note, date }));
}

export async function addLog(req, res) {
  const activity = await activityService.addLog(parseId(req.params.id), parseLogInput(req.body));
  res.status(201).json(activity);
}

export async function removeLog(req, res) {
  res.json(await activityService.removeLog(parseId(req.params.id), parseId(req.params.logId)));
}
