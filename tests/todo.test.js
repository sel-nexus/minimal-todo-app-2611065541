const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script, 'index.html must contain its application script');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.classList = {
      values: new Set(),
      add: (value) => this.classList.values.add(value),
      contains: (value) => this.classList.values.has(value),
    };
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.checked = false;
    this.type = '';
    this.id = '';
    this.className = '';
  }

  append(...elements) {
    this.children.push(...elements);
  }

  replaceChildren(...elements) {
    this.children = [...elements];
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) ?? [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  dispatch(name, event = {}) {
    for (const callback of this.listeners.get(name) ?? []) {
      callback({ preventDefault() {}, target: this, ...event });
    }
    if (name === 'keydown' && event.key === 'Enter' && this === this.ownerDocument.activeElement) {
      this.ownerDocument.getElementById('todo-form').dispatch('submit');
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function createApp() {
  const elements = new Map([
    ['todo-form', new Element('form')],
    ['todo-input', new Element('input')],
    ['empty-state', new Element('p')],
    ['todo-list', new Element('ul')],
  ]);
  elements.get('empty-state').textContent = 'No tasks yet.';
  const document = {
    activeElement: null,
    getElementById: (id) => elements.get(id),
    createElement: (tagName) => new Element(tagName),
  };
  for (const element of elements.values()) element.ownerDocument = document;
  document.createElement = (tagName) => {
    const element = new Element(tagName);
    element.ownerDocument = document;
    return element;
  };
  vm.runInNewContext(script, { document, console });
  return { elements };
}

function submit(app, value) {
  const input = app.elements.get('todo-input');
  input.value = value;
  app.elements.get('todo-form').dispatch('submit');
}

test('initial render exposes the exact empty state and an empty list', () => {
  const app = createApp();
  assert.equal(app.elements.get('empty-state').textContent, 'No tasks yet.');
  assert.equal(app.elements.get('empty-state').hidden, false);
  assert.deepEqual(app.elements.get('todo-list').children, []);
});

test('submission trims titles, assigns sequential IDs, and clears the input', () => {
  const app = createApp();
  submit(app, '  First task  ');
  submit(app, 'Second task');
  const items = app.elements.get('todo-list').children;
  assert.deepEqual(items.map((item) => item.dataset.testid), ['todo-item-1', 'todo-item-2']);
  assert.equal(items[0].children[1].textContent, 'First task');
  assert.equal(items[1].children[1].textContent, 'Second task');
  assert.equal(app.elements.get('todo-input').value, '');
  assert.equal(app.elements.get('empty-state').hidden, true);
});

test('pressing Enter on the focused input submits a task and clears the input', () => {
  const app = createApp();
  const input = app.elements.get('todo-input');
  input.value = 'Keyboard task';
  input.focus();
  input.dispatch('keydown', { key: 'Enter' });
  const items = app.elements.get('todo-list').children;
  assert.equal(items.length, 1);
  assert.equal(items[0].dataset.testid, 'todo-item-1');
  assert.equal(items[0].children[1].textContent, 'Keyboard task');
  assert.equal(input.value, '');
});

test('empty and whitespace-only submissions do not create tasks', () => {
  const app = createApp();
  submit(app, '');
  submit(app, '   \t  ');
  assert.equal(app.elements.get('todo-list').children.length, 0);
  assert.equal(app.elements.get('empty-state').hidden, false);
});

test('checkbox toggles only its task and updates completion styling', () => {
  const app = createApp();
  submit(app, 'First');
  submit(app, 'Second');
  const firstCheckbox = app.elements.get('todo-list').children[0].children[0];
  firstCheckbox.checked = true;
  firstCheckbox.dispatch('change');
  const items = app.elements.get('todo-list').children;
  assert.equal(items[0].children[0].checked, true);
  assert.equal(items[0].children[1].classList.contains('completed'), true);
  assert.equal(items[1].children[0].checked, false);
  assert.equal(items[1].children[1].classList.contains('completed'), false);
  items[0].children[0].checked = false;
  items[0].children[0].dispatch('change');
  assert.equal(app.elements.get('todo-list').children[0].children[1].classList.contains('completed'), false);
});

test('delete removes only the selected task and final deletion restores empty state', () => {
  const app = createApp();
  submit(app, 'First');
  submit(app, 'Second');
  app.elements.get('todo-list').children[0].children[2].dispatch('click');
  assert.deepEqual(app.elements.get('todo-list').children.map((item) => item.dataset.testid), ['todo-item-2']);
  app.elements.get('todo-list').children[0].children[2].dispatch('click');
  assert.equal(app.elements.get('todo-list').children.length, 0);
  assert.equal(app.elements.get('empty-state').hidden, false);
  assert.equal(app.elements.get('empty-state').textContent, 'No tasks yet.');
});
