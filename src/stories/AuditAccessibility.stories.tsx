const meta = {
  title: 'Audit/Accessibility',
  tags: ['autodocs'],
};

export default meta;

export const Default = {
  render: () => (
    <main
      data-testid="audit-accessibility-smoke"
      style={{
        background: '#ffffff',
        color: '#111827',
        fontFamily: 'Arial, sans-serif',
        margin: '0 auto',
        maxWidth: 720,
        padding: 32,
      }}
    >
      <h1>Accessibility smoke fixture</h1>
      <p>Keyboard, label, focus, and contrast checks use this local Storybook fixture.</p>
      <form>
        <label htmlFor="audit-name">Name</label>
        <input id="audit-name" name="name" placeholder="Enter a name" />
        <button type="submit">Save</button>
      </form>
    </main>
  ),
};
