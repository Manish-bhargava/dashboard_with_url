const API_BASE_URL = '/api/reportanalytics';

export const getDepartmentList = async (unit) => {
  try {
    const response = await fetch(`${API_BASE_URL}/getDepartmentList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ unit }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 'success') {
      return data.department;
    } else {
      throw new Error(data.message || 'Failed to fetch departments');
    }
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
}; 