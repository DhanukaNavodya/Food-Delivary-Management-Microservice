import { Customer } from '../models/Customer.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginate } from '../utils/pagination.js';
import { pick } from '../utils/pick.js';
import { ROLES } from '../utils/roles.js';

const PROFILE_FIELDS = ['name', 'email', 'phone'];
const ADDRESS_FIELDS = ['label', 'street', 'city', 'postalCode', 'isDefault'];

// Resolves `:id` (or the alias `me`) to a customer the current user may access.
async function findAccessibleCustomer(req) {
  const { id } = req.params;
  const customer = id === 'me'
    ? await Customer.findOne({ userId: req.user.id })
    : await Customer.findById(id);

  if (!customer) {
    throw ApiError.notFound(id === 'me'
      ? 'Customer profile not found. Create one with POST /api/customers'
      : 'Customer not found');
  }
  if (req.user.role !== ROLES.ADMIN && customer.userId !== req.user.id) {
    throw ApiError.forbidden('You can only access your own customer profile');
  }
  return customer;
}

function setDefaultAddress(customer, addressId) {
  customer.addresses.forEach((address) => {
    address.isDefault = address.id === addressId;
  });
}

export async function listCustomers(req, res) {
  const { search } = req.query;
  const filter = {};
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  res.json(await paginate(Customer, filter, req.query));
}

export async function createCustomer(req, res) {
  const isAdmin = req.user.role === ROLES.ADMIN;
  const userId = isAdmin && req.body?.userId ? String(req.body.userId) : req.user.id;

  if (await Customer.exists({ userId })) {
    throw ApiError.conflict('A customer profile already exists for this user');
  }

  const customer = new Customer({
    userId,
    name: req.user.name,
    email: req.user.email,
    ...pick(req.body, PROFILE_FIELDS),
    addresses: Array.isArray(req.body?.addresses)
      ? req.body.addresses.map((address) => pick(address, ADDRESS_FIELDS))
      : []
  });
  if (customer.addresses.length && !customer.addresses.some((address) => address.isDefault)) {
    customer.addresses[0].isDefault = true;
  }

  await customer.save();
  res.status(201).json(customer);
}

export async function getCustomer(req, res) {
  res.json(await findAccessibleCustomer(req));
}

export async function updateCustomer(req, res) {
  const customer = await findAccessibleCustomer(req);
  Object.assign(customer, pick(req.body, PROFILE_FIELDS));
  await customer.save();
  res.json(customer);
}

export async function deleteCustomer(req, res) {
  const customer = await findAccessibleCustomer(req);
  await customer.deleteOne();
  res.status(204).end();
}

export async function listAddresses(req, res) {
  const customer = await findAccessibleCustomer(req);
  res.json(customer.addresses);
}

export async function addAddress(req, res) {
  const customer = await findAccessibleCustomer(req);
  const address = customer.addresses.create(pick(req.body, ADDRESS_FIELDS));
  customer.addresses.push(address);

  if (address.isDefault || customer.addresses.length === 1) setDefaultAddress(customer, address.id);

  await customer.save();
  res.status(201).json(customer);
}

export async function updateAddress(req, res) {
  const customer = await findAccessibleCustomer(req);
  const address = customer.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');

  Object.assign(address, pick(req.body, ADDRESS_FIELDS));
  if (req.body?.isDefault === true) setDefaultAddress(customer, address.id);

  await customer.save();
  res.json(customer);
}

export async function deleteAddress(req, res) {
  const customer = await findAccessibleCustomer(req);
  const address = customer.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');

  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && customer.addresses.length) customer.addresses[0].isDefault = true;

  await customer.save();
  res.json(customer);
}
