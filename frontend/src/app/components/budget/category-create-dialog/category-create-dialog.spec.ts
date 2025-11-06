import { CategoryCreateDialog, CategoryCreateDialogData } from './category-create-dialog';

describe('CategoryCreateDialog', () => {
  const createData: CategoryCreateDialogData = {
    mode: 'create',
    parentCategoryId: 'parent-1',
    title: 'Créer',
    nameLabel: 'Nom',
    placeholder: 'Placeholder',
  };

  const editData: CategoryCreateDialogData = {
    mode: 'edit',
    category: {
      id: 'cat-1',
      name: 'Alimentation',
      kind: 'EXPENSE',
      parentCategoryId: 'parent-1',
      sortOrder: 1,
      archived: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  };

  const createMocks = (data: CategoryCreateDialogData) => {
    const dialogRef = { close: jest.fn() };
    const categoriesStore = {
      clearError: jest.fn(),
      error: jest.fn().mockReturnValue(null),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const budgetStore = {
      reloadCurrentMonth: jest.fn().mockResolvedValue(undefined),
    };
    const component = new CategoryCreateDialog(
      dialogRef as any,
      categoriesStore as any,
      budgetStore as any,
      data,
    );
    return { component, dialogRef, categoriesStore, budgetStore };
  };

  it('derives labels from data or defaults', () => {
    const { component } = createMocks(createData);
    expect(component.title).toBe('Créer');
    expect(component.nameLabel).toBe('Nom');
    expect(component.placeholder).toBe('Placeholder');

    const edit = createMocks(editData).component;
    expect(edit.title).toBe('Modifier la catégorie');
    expect(edit.submitLabel).toBe('Mettre à jour');
    expect(edit.isEdit()).toBe(true);
  });

  it('disables submit while submitting or when input empty', () => {
    const { component } = createMocks(createData);
    expect(component.disableSubmit).toBe(true);
    component.nameControl.setValue('Test');
    expect(component.disableSubmit).toBe(false);
    component.isSubmitting.set(true);
    expect(component.disableSubmit).toBe(true);
  });

  it('closes only when not submitting', () => {
    const { component, dialogRef } = createMocks(createData);
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith(false);

    component.isSubmitting.set(true);
    component.close();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('prevents submission when value empty', async () => {
    const { component, categoriesStore } = createMocks(createData);
    component.nameControl.setValue('   ');
    await component.submit();
    expect(component.nameControl.touched).toBe(true);
    expect(categoriesStore.create).not.toHaveBeenCalled();
  });

  it('creates a category successfully', async () => {
    const { component, categoriesStore, budgetStore, dialogRef } = createMocks(createData);
    component.nameControl.setValue(' Courses ');
    categoriesStore.create.mockResolvedValue({ id: 'new-cat' });

    await component.submit();

    expect(categoriesStore.create).toHaveBeenCalledWith({
      name: 'Courses',
      kind: 'EXPENSE',
      parentCategoryId: 'parent-1',
      sortOrder: undefined,
    });
    expect(budgetStore.reloadCurrentMonth).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
    expect(component.isSubmitting()).toBe(false);
  });

  it('surfaces store error when creation fails', async () => {
    const { component, categoriesStore, dialogRef } = createMocks(createData);
    component.nameControl.setValue('Courses');
    categoriesStore.create.mockResolvedValue(null);
    categoriesStore.error.mockReturnValue('Store error');

    await component.submit();

    expect(component.hasError()).toBe('Store error');
    expect(dialogRef.close).not.toHaveBeenCalledWith(true);
  });

  it('handles unexpected creation failures', async () => {
    const { component, categoriesStore } = createMocks(createData);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    component.nameControl.setValue('Courses');
    categoriesStore.create.mockRejectedValue(new Error('boom'));

    await component.submit();

    expect(component.hasError()).toBe('Une erreur est survenue. Veuillez réessayer.');
    errorSpy.mockRestore();
  });

  it('closes immediately when edit value unchanged', async () => {
    const { component, dialogRef } = createMocks(editData);
    component.nameControl.setValue('Alimentation');
    await component.submit();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('updates a category successfully', async () => {
    const { component, categoriesStore, budgetStore, dialogRef } = createMocks(editData);
    component.nameControl.setValue('Courses');
    categoriesStore.update.mockResolvedValue({ id: 'cat-1' });

    await component.submit();

    expect(categoriesStore.update).toHaveBeenCalledWith('cat-1', { name: 'Courses' });
    expect(budgetStore.reloadCurrentMonth).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('handles update failures from store', async () => {
    const { component, categoriesStore } = createMocks(editData);
    component.nameControl.setValue('Courses');
    categoriesStore.update.mockResolvedValue(null);
    categoriesStore.error.mockReturnValue('Update failed');

    await component.submit();

    expect(component.hasError()).toBe('Update failed');
  });

  it('handles unexpected update errors', async () => {
    const { component, categoriesStore } = createMocks(editData);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    component.nameControl.setValue('Courses');
    categoriesStore.update.mockRejectedValue(new Error('boom'));

    await component.submit();

    expect(component.hasError()).toBe('Une erreur est survenue. Veuillez réessayer.');
    errorSpy.mockRestore();
  });

  it('skips delete when not allowed', async () => {
    const { component, categoriesStore } = createMocks(createData);
    component.isSubmitting.set(true);
    await component.deleteCategory();
    expect(categoriesStore.remove).not.toHaveBeenCalled();
  });

  it('deletes category when confirmed', async () => {
    const { component, categoriesStore, budgetStore, dialogRef } = createMocks(editData);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    categoriesStore.remove.mockResolvedValue(true);

    await component.deleteCategory();

    expect(categoriesStore.remove).toHaveBeenCalledWith('cat-1');
    expect(budgetStore.reloadCurrentMonth).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
    confirmSpy.mockRestore();
  });

  it('stores errors when deletion fails', async () => {
    const { component, categoriesStore } = createMocks(editData);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    categoriesStore.remove.mockResolvedValue(false);
    categoriesStore.error.mockReturnValue('Cannot delete');

    await component.deleteCategory();

    expect(component.hasError()).toBe('Cannot delete');
    confirmSpy.mockRestore();
  });

  it('handles unexpected deletion errors', async () => {
    const { component, categoriesStore } = createMocks(editData);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    categoriesStore.remove.mockRejectedValue(new Error('boom'));

    await component.deleteCategory();

    expect(component.hasError()).toBe('Une erreur est survenue. Veuillez réessayer.');
    confirmSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
