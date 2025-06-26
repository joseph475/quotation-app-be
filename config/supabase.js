const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for backend operations
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create client with anon key for frontend-like operations
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Database connection test
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
};

// Helper function to handle Supabase errors
const handleSupabaseError = (error) => {
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message || 'Database operation failed');
  }
};

// Helper function to format Supabase response
const formatResponse = (data, error) => {
  handleSupabaseError(error);
  return data;
};

// Helper function to convert MongoDB-style queries to Supabase
const buildSupabaseQuery = (table, filters = {}, options = {}) => {
  let query = supabase.from(table);
  
  // Handle select
  if (options.select) {
    query = query.select(options.select);
  } else {
    query = query.select('*');
  }
  
  // Handle filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && value.$regex) {
        // Handle regex search
        query = query.ilike(key, `%${value.$regex}%`);
      } else if (typeof value === 'object' && value.$in) {
        // Handle $in operator
        query = query.in(key, value.$in);
      } else if (typeof value === 'object' && value.$gte) {
        // Handle $gte operator
        query = query.gte(key, value.$gte);
      } else if (typeof value === 'object' && value.$lte) {
        // Handle $lte operator
        query = query.lte(key, value.$lte);
      } else {
        // Handle exact match
        query = query.eq(key, value);
      }
    }
  });
  
  // Handle sorting
  if (options.sort) {
    Object.entries(options.sort).forEach(([key, direction]) => {
      query = query.order(key, { ascending: direction === 1 });
    });
  }
  
  // Handle limit
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  // Handle offset
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 1000) - 1);
  }
  
  return query;
};

// Helper function to handle joins/populate
const handlePopulate = async (data, populateConfig) => {
  if (!populateConfig || !Array.isArray(data)) {
    return data;
  }
  
  // This is a simplified populate - you may need to enhance based on your needs
  for (const config of populateConfig) {
    const { path, select, from } = config;
    
    if (from && select) {
      const ids = data.map(item => item[path]).filter(Boolean);
      if (ids.length > 0) {
        const { data: relatedData } = await supabase
          .from(from)
          .select(select)
          .in('id', ids);
        
        // Map related data back to original data
        data.forEach(item => {
          if (item[path]) {
            item[path] = relatedData.find(related => related.id === item[path]);
          }
        });
      }
    }
  }
  
  return data;
};

module.exports = {
  supabase,
  supabaseAnon,
  testConnection,
  handleSupabaseError,
  formatResponse,
  buildSupabaseQuery,
  handlePopulate
};
