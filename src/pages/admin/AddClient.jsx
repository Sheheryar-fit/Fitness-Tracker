import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus, Copy, Check, CircleCheck, TriangleAlert, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  generateUsername,
  generatePassword,
  getLocalDateString,
  toTotalInches
} from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import ClientFormFields from '../../components/ClientFormFields'

/**
 * Add Client Page (Admin)
 * Form to create a new client with auto-generated credentials
 */
export default function AddClient() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [heightFeet, setHeightFeet] = useState('')
  const [heightInches, setHeightInches] = useState('')
  const [startingWeight, setStartingWeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [goal, setGoal] = useState('fat_loss')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState(null) // { username, password }
  const [copied, setCopied] = useState(false)

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Validate
    if (!name.trim()) {
      setError('Client name is required')
      return
    }
    if (parseFloat(heightInches) >= 12) {
      setError('Height inches must be less than 12')
      return
    }

    setLoading(true)

    try {
      // Generate a password and create the client's login.
      // The database adds _2, _3... if the username is already taken.
      const password = generatePassword(8)
      const { data: login, error: loginError } = await supabase
        .rpc('create_client_login', {
          p_username: generateUsername(name),
          p_password: password
        })
        .single()

      if (loginError) throw loginError
      const username = login.new_username

      // Create client record
      const { error: clientError } = await supabase.from('clients').insert({
        user_id: login.new_user_id,
        trainer_id: user.id,
        name: name.trim(),
        age: parseInt(age) || null,
        height: toTotalInches(heightFeet, heightInches),
        starting_weight: parseFloat(startingWeight) || null,
        current_weight: parseFloat(currentWeight) || parseFloat(startingWeight) || null,
        goal: goal,
        join_date: getLocalDateString()
      })

      if (clientError) throw clientError

      // Show generated credentials
      setCredentials({ username, password })
    } catch (err) {
      console.error('Error adding client:', err)
      setError(err.message || 'Failed to add client')
    } finally {
      setLoading(false)
    }
  }

  async function copyCredentials() {
    try {
      await navigator.clipboard.writeText(
        `Username: ${credentials.username}\nPassword: ${credentials.password}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Could not copy:', err)
    }
  }

  // Client created: show the generated login details
  if (credentials) {
    return (
      <div>
        <PageHeader
          back={{ to: '/admin/clients', label: 'Clients' }}
          title="Client created"
          subtitle="Share these login details with your client"
        />

        <div className="card" style={{ maxWidth: '520px' }}>
          <div className="card-header">
            <span className="card-title">
              <CircleCheck size={22} aria-hidden="true" style={{ color: 'var(--success)' }} />
              Login for {name}
            </span>
          </div>

          <div className="credentials-box">
            <div className="credentials-row">
              <span className="cred-label">Username</span>
              <span className="cred-value">{credentials.username}</span>
            </div>
            <div className="credentials-row">
              <span className="cred-label">Password</span>
              <span className="cred-value">{credentials.password}</span>
            </div>
          </div>

          <p className="form-hint" style={{ marginBottom: '1.25rem' }}>
            Save these now. The password can't be shown again, but you can reset it later from the
            client's page.
          </p>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={copyCredentials} id="copy-credentials-btn">
              {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy Credentials'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/admin/clients')}
              id="go-to-clients-btn"
            >
              <Users size={18} aria-hidden="true" />
              Go to Clients
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        back={{ to: '/admin/clients', label: 'Clients' }}
        title="Add new client"
        subtitle="Their username and password are created automatically"
      />

      <div className="card" style={{ maxWidth: '680px' }}>
        {error && (
          <div className="alert alert-error" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <ClientFormFields
            idPrefix="client"
            disabled={loading}
            name={name} setName={setName}
            age={age} setAge={setAge}
            heightFeet={heightFeet} setHeightFeet={setHeightFeet}
            heightInches={heightInches} setHeightInches={setHeightInches}
            startingWeight={startingWeight} setStartingWeight={setStartingWeight}
            currentWeight={currentWeight} setCurrentWeight={setCurrentWeight}
            goal={goal} setGoal={setGoal}
          />

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              id="submit-client-btn"
            >
              {loading ? <span className="btn-spinner" aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
              {loading ? 'Creating...' : 'Add Client'}
            </button>
            <Link to="/admin/clients" className="btn btn-ghost" aria-disabled={loading}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
