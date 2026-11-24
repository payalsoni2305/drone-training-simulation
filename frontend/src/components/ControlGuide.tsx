import { CONTROL_HELP } from './controls'

export function ControlGuide() {
  const groups = ['Fly', 'Camera', 'System'] as const
  return (
    <div className="guide">
      {groups.map((group) => (
        <section key={group}>
          <h4>{group}</h4>
          <ul>
            {CONTROL_HELP.filter((c) => c.group === group).map((c) => (
              <li key={c.action}>
                <span className="keys">
                  {c.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
                <span>{c.action}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
