import { Flame, Dumbbell } from 'lucide-react'

const GOALS = [
  { value: 'fat_loss', label: 'Fat Loss', text: 'Lose weight, keep strength', icon: Flame },
  { value: 'muscle_gain', label: 'Muscle Gain', text: 'Build size and strength', icon: Dumbbell }
]

/**
 * ClientFormFields Component - the profile fields shared by Add Client and Edit Client
 * Field ids are `${idPrefix}-name`, `${idPrefix}-age`, ...
 */
export default function ClientFormFields({
  idPrefix,
  disabled,
  name, setName,
  age, setAge,
  heightFeet, setHeightFeet,
  heightInches, setHeightInches,
  startingWeight, setStartingWeight,
  currentWeight, setCurrentWeight,
  goal, setGoal
}) {
  const id = (field) => `${idPrefix}-${field}`

  return (
    <>
      <div className="form-group">
        <label className="form-label" htmlFor={id('name')}>
          Full name *
        </label>
        <input
          id={id('name')}
          type="text"
          className="form-input"
          placeholder="e.g. John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          disabled={disabled}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor={id('age')}>
            Age
          </label>
          <input
            id={id('age')}
            type="number"
            inputMode="numeric"
            className="form-input"
            placeholder="e.g. 25"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min="10"
            max="100"
            disabled={disabled}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={id('height-ft')}>
            Height
          </label>
          <div className="height-inputs">
            <input
              id={id('height-ft')}
              type="number"
              inputMode="numeric"
              className="form-input"
              placeholder="5"
              aria-label="Height feet"
              value={heightFeet}
              onChange={(e) => setHeightFeet(e.target.value)}
              min="0"
              max="8"
              step="1"
              disabled={disabled}
            />
            <span>ft</span>
            <input
              id={id('height-in')}
              type="number"
              inputMode="decimal"
              className="form-input"
              placeholder="7"
              aria-label="Height inches"
              value={heightInches}
              onChange={(e) => setHeightInches(e.target.value)}
              min="0"
              max="11.5"
              step="0.5"
              disabled={disabled}
            />
            <span>in</span>
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor={id('starting-weight')}>
            Starting weight (kg)
          </label>
          <input
            id={id('starting-weight')}
            type="number"
            inputMode="decimal"
            className="form-input"
            placeholder="e.g. 80"
            value={startingWeight}
            onChange={(e) => setStartingWeight(e.target.value)}
            step="0.1"
            disabled={disabled}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={id('current-weight')}>
            Current weight (kg)
          </label>
          <input
            id={id('current-weight')}
            type="number"
            inputMode="decimal"
            className="form-input"
            placeholder="e.g. 78"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            step="0.1"
            disabled={disabled}
          />
        </div>
      </div>

      <fieldset className="form-group choice-fieldset">
        <legend className="form-label">Goal</legend>
        <div className="choice-group" id={id('goal')}>
          {GOALS.map(({ value, label, text, icon: Icon }) => (
            <label key={value} className={`choice ${goal === value ? 'selected' : ''}`}>
              <input
                type="radio"
                name={id('goal')}
                value={value}
                checked={goal === value}
                onChange={() => setGoal(value)}
                disabled={disabled}
                className="sr-only"
              />
              <span className="icon-chip">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="choice-title">{label}</span>
                <span className="choice-text">{text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}
