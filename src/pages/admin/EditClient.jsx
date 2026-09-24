import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Save, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { splitHeight, toTotalInches } from '../../utils/calculations'
import PageHeader from '../../components/PageHeader'
import ClientFormFields from '../../components/ClientFormFields'
import Loading from '../../components/Loading'
import Toast from '../../components/Toast'

/**
 * Edit Client Page (Admin)
 * Edit all client fields except join_date
 */
export default function EditClient() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [age, setAge] = useState('')
  const [heightFeet, setHeightFeet] = useState('')
  const [heightInches, setHeightInches] = useState('')
  const [startingWeight, setStartingWeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [goal, setGoal] = useState('fat_loss')

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Fetch existing client data
  useEffect(() => {
    async function fetchClient() {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', id)
          .eq('trainer_id', user.id)
          .single()

        if (error) throw error
        if (!data) {
          navigate('/admin/clients')
          return
        }

        // Populate form
        setName(data.name || '')
        setSavedName(data.name || '')
        setAge(data.age?.toString() || '')
        const height = splitHeight(data.height)
        setHeightFeet(height ? height.feet.toString() : '')
        setHeightInches(height ? height.inches.toString() : '')
        setStartingWeight(data.starting_weight?.toString() || '')
        setCurrentWeight(data.current_weight?.toString() || '')
        setGoal(data.goal || 'fat_loss')
      } catch (err) {
        console.error('Error fetching client:', err)
        navigate('/admin/clients')
      } finally {
        setLoading(false)
      }
    }

    fetchClient()
  }, [id])

  // Handle save
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Client name is required')
      return
    }
    if (parseFloat(heightInches) >= 12) {
      setError('Height inches must be less than 12')
      return
    }

    setSaving(true)

    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          name: name.trim(),
          age: parseInt(age) || null,
          height: toTotalInches(heightFeet, heightInches),
          starting_weight: parseFloat(startingWeight) || null,
          current_weight: parseFloat(currentWeight) || null,
          goal: goal
        })
        .eq('id', id)
        .eq('trainer_id', user.id)

      if (updateError) throw updateError

      setSavedName(name.trim())
      setToast('Changes saved successfully!')
      setTimeout(() => setToast(''), 3000)
    } catch (err) {
      console.error('Error updating client:', err)
      setError(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div>
      <PageHeader
        back={{ to: `/admin/clients/${id}`, label: savedName || 'Client' }}
        title="Edit client"
        subtitle={`Update ${savedName}'s details`}
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
            idPrefix="edit"
            disabled={saving}
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
              disabled={saving}
              id="save-client-btn"
            >
              {saving ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link to={`/admin/clients/${id}`} className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <Toast message={toast} />
    </div>
  )
}
