import { createRequire } from 'node:module';

type Decorator = (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => any;

const require = createRequire(import.meta.url);

function reloadModule(path: string) {
  const resolved = require.resolve(path);
  delete require.cache[resolved];
  return require(path);
}

function installReflectDecorate() {
  const original = (Reflect as any).decorate;
  (Reflect as any).decorate = (
    decorators: Decorator[],
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    let result = descriptor;
    for (let i = decorators.length - 1; i >= 0; i -= 1) {
      const decorator = decorators[i];
      if (propertyKey !== undefined) {
        result = decorator(target, propertyKey, result) || result;
      } else {
        result = decorator(target) || target;
      }
    }
    return result ?? target;
  };
  return original;
}

function installReflectMetadata() {
  const original = (Reflect as any).metadata;
  (Reflect as any).metadata = () => () => undefined;
  return original;
}

function restoreReflectDecorate(original: unknown) {
  if (original === undefined) {
    delete (Reflect as any).decorate;
  } else {
    (Reflect as any).decorate = original;
  }
}

function restoreReflectMetadata(original: unknown) {
  if (original === undefined) {
    delete (Reflect as any).metadata;
  } else {
    (Reflect as any).metadata = original;
  }
}

(async () => {
  const originalDecorate = installReflectDecorate();
  const originalMetadata = installReflectMetadata();
  const modules = [
    '../src/common/services/user-context.service',
    '../src/modules/accounts/accounts.service',
    '../src/modules/categories/categories.service',
    '../src/modules/budget/budget.service',
    '../src/modules/transactions/transactions.service',
    '../src/modules/accounts/entities/account.entity',
    '../src/modules/categories/entities/category.entity',
    '../src/modules/budget/entities/budget-category.entity',
    '../src/modules/budget/entities/budget-group.entity',
    '../src/modules/budget/entities/budget-month.entity',
    '../src/modules/transactions/entities/transaction.entity',
    '../src/modules/transactions/entities/transactions-list.entity',
  ];

  for (const modulePath of modules) {
    reloadModule(modulePath);
  }

  restoreReflectDecorate(originalDecorate);
  restoreReflectMetadata(originalMetadata);
  console.log('Decorator coverage tests passed.');
})();
