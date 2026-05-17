import { App, Modal, Setting } from 'obsidian';
import { toDateTimeInputValue } from './ui';
import type { PriorityOption, TodoTask } from './types';

export interface TaskEditValue {
  text: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  priority?: string;
}

export class EditTaskModal extends Modal {
  private value: TaskEditValue;
  private onSubmit: (value: TaskEditValue) => void;
  private priorityOptions: PriorityOption[];

  constructor(
    app: App,
    task: TodoTask,
    priorityOptions: PriorityOption[],
    onSubmit: (value: TaskEditValue) => void,
  ) {
    super(app);
    this.priorityOptions = priorityOptions;
    this.onSubmit = onSubmit;
    this.value = {
      text: task.displayText || task.text,
      startDate: toDateTimeInputValue(task.startDate),
      endDate: toDateTimeInputValue(task.endDate),
      dueDate: toDateTimeInputValue(task.dueDate),
      priority: task.priority ?? '',
    };
  }

  onOpen(): void {
    this.setTitle('编辑待办');
    this.contentEl.addClass('daily-todolist-modal');

    new Setting(this.contentEl)
      .setName('任务内容')
      .addText((text) => {
        text.setValue(this.value.text)
          .onChange((value) => {
            this.value.text = value;
          });
        text.inputEl.focus();
      });

    this.createDateTimePicker('开始时间', this.value.startDate, (value) => {
      this.value.startDate = value;
    });
    this.createDateTimePicker('结束时间', this.value.endDate, (value) => {
      this.value.endDate = value;
    });
    this.createDateTimePicker('到期时间', this.value.dueDate, (value) => {
      this.value.dueDate = value;
    });
    this.createPriorityPicker();

    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText('保存修改')
        .setCta()
        .onClick(() => this.submit()));
  }

  private createDateTimePicker(name: string, value: string | undefined, onChange: (value: string) => void): void {
    const setting = new Setting(this.contentEl).setName(name);
    const input = setting.controlEl.createEl('input', {
      type: 'datetime-local',
      cls: 'daily-todolist-date-input',
    });
    input.value = value ?? '';
    input.addEventListener('change', () => onChange(input.value.trim()));
  }

  private createPriorityPicker(): void {
    new Setting(this.contentEl)
      .setName('优先级')
      .addDropdown((dropdown) => {
        dropdown.addOption('', '无优先级');
        for (const option of this.priorityOptions) {
          dropdown.addOption(option.id, option.label);
        }
        dropdown.setValue(this.value.priority ?? '');
        dropdown.onChange((value) => {
          this.value.priority = value;
        });
      });
  }

  private submit(): void {
    if (!this.value.text.trim()) return;
    this.close();
    this.onSubmit(this.value);
  }
}
